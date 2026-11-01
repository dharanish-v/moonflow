// Shapes the schema's field types can't express (JSON arrays), matching the
// app's own import checks (apps/moonflow-pwa-react/src/lib/import.ts).
// Not a .pb.js file, so PocketBase only loads it through require().

const DATE = /^\d{4}-\d{2}-\d{2}$/

function strings(value, field, maxItems, maxLength) {
  if (value === null || value === undefined || value === "") return
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new BadRequestError(`${field} must be a list of at most ${maxItems} items.`)
  }
  for (const item of value) {
    if (typeof item !== "string" || item.trim() === "" || item.length > maxLength) {
      throw new BadRequestError(`${field} items must be text, 1–${maxLength} characters.`)
    }
  }
}

function dates(value, field, maxItems) {
  if (value === null || value === undefined || value === "") return
  if (!Array.isArray(value) || value.length > maxItems || !value.every((d) => typeof d === "string" && DATE.test(d))) {
    throw new BadRequestError(`${field} must be a list of at most ${maxItems} YYYY-MM-DD dates.`)
  }
}

// JSON fields come back from the record as raw bytes; parse them first.
function json(record, field) {
  const raw = record.get(field)
  if (raw === null || raw === undefined) return null
  const text = toString(raw)
  return text === "" || text === "null" ? null : JSON.parse(text)
}

function times(value, field, maxItems) {
  if (value === null || value === undefined || value === "") return
  if (!Array.isArray(value) || value.length > maxItems || !value.every((t) => Number.isInteger(t) && t > 0)) {
    throw new BadRequestError(`${field} must be a list of at most ${maxItems} times (Unix seconds).`)
  }
}

module.exports = {
  entry(record) {
    strings(json(record, "tags"), "tags", 30, 40)
  },
  cycleSettings(record) {
    strings(json(record, "customTags"), "customTags", 200, 40)
    dates(json(record, "confirmedLongCycles"), "confirmedLongCycles", 500)
  },
  pushSubscription(record) {
    times(json(record, "reminders"), "reminders", 12)
  },
}
