// T103 (ADR-055) — sends the push reminders that are due. Called by the tick
// route once a minute. Pushes carry no payload: the phone's service worker
// decides what the notification says.

const STALE_S = 12 * 3600 // a reminder more than 12 h late is skipped, not sent
const JWT_LIFETIME_S = 12 * 3600 // push services accept up to 24 h
const SUBJECT = "https://github.com/dharanish-v/moonflow"

function parseJson(raw) {
  const text = raw === null || raw === undefined ? "" : toString(raw)
  return text === "" || text === "null" ? [] : JSON.parse(text)
}

/** One signed VAPID JWT per push service, reused until it nears expiry. */
function authorization(vapid, privateKey, endpoint, now) {
  const audience = endpoint.match(/^https?:\/\/[^/]+/)[0]
  const store = $app.store()
  const cacheKey = `vapid:${audience}`
  let cached = store.get(cacheKey)
  if (!cached || cached.exp - now < 3600) {
    const exp = now + JWT_LIFETIME_S
    cached = { exp, jwt: vapid.vapidJwt(privateKey, audience, SUBJECT, exp) }
    store.set(cacheKey, cached)
  }
  return `vapid t=${cached.jwt}, k=${vapid.vapidPublicKey(privateKey)}`
}

function tick(app, now) {
  const privateKey = $os.getenv("VAPID_PRIVATE_KEY")
  if (!privateKey) throw new Error("VAPID_PRIVATE_KEY is not set")
  const vapid = require(`${__hooks}/lib/vapid.js`)
  const result = { checked: 0, sent: 0, skipped: 0, removed: 0, failed: 0 }

  for (const row of app.findAllRecords("push_subscriptions")) {
    result.checked++
    const sentUpTo = row.getInt("sentUpTo")
    const due = parseJson(row.get("reminders")).filter((t) => t <= now && t > sentUpTo)
    if (due.length === 0) continue
    const newest = Math.max(...due)

    if (newest < now - STALE_S) {
      row.set("sentUpTo", newest)
      app.save(row)
      result.skipped++
      continue
    }

    const endpoint = row.getString("endpoint")
    let status = 0
    try {
      status = $http.send({
        url: endpoint,
        method: "POST",
        headers: {
          Authorization: authorization(vapid, privateKey, endpoint, now),
          TTL: "86400",
          Urgency: "normal",
          "Content-Length": "0",
        },
        body: "",
        timeout: 10,
      }).statusCode
    } catch (err) {
      status = 0
    }

    if (status === 404 || status === 410) {
      app.delete(row) // the device unsubscribed or the app was removed
      result.removed++
    } else if (status >= 200 && status < 300) {
      row.set("sentUpTo", newest)
      app.save(row)
      result.sent++
    } else {
      result.failed++ // retried on the next tick
    }
  }
  return result
}

module.exports = { tick }
