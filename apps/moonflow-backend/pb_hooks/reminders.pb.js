/// <reference path="../pb_data/types.d.ts" />
// T103 (ADR-055) — called once a minute by a PocketHost webhook
// (GET /api/moonflow/reminders/tick?key=…). The key keeps strangers from
// triggering it; sending is idempotent anyway.
routerAdd("GET", "/api/moonflow/reminders/tick", (e) => {
  const key = $os.getenv("REMINDER_TICK_KEY")
  if (!key || e.request.url.query().get("key") !== key) {
    return e.json(403, { message: "Forbidden." })
  }
  const now = Math.floor(Date.now() / 1000)
  return e.json(200, require(`${__hooks}/lib/reminders.js`).tick($app, now))
})
