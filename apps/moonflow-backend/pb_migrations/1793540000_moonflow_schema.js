/// <reference path="../pb_data/types.d.ts" />
// T97 (ADR-053) — accounts and the synced data. Field meanings follow
// docs/data-format.md. PocketBase stores "no value" as the field's zero value:
// an empty select or text, or a number of 0, means null in the app.

const DATE_PATTERN = "^\\d{4}-\\d{2}-\\d{2}$"
const SYMPTOMS = [
  "cramps", "headache", "bloating", "fatigue", "backache", "nausea", "tender_breasts", "acne",
  "hot_flashes", "night_sweats", "poor_sleep", "brain_fog", "joint_aches", "vaginal_dryness",
]

// Every synced row belongs to exactly one user, and only that user can see or
// change it. The update rule also stops a row being handed to someone else.
const OWNER_ONLY = {
  listRule: "user = @request.auth.id",
  viewRule: "user = @request.auth.id",
  createRule: "@request.auth.id != '' && user = @request.auth.id",
  updateRule: "user = @request.auth.id && (@request.body.user:isset = false || @request.body.user = @request.auth.id)",
  deleteRule: "user = @request.auth.id",
}

migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  // Email + password only (no outgoing email, so no verification, codes or
  // new-location alerts). The owner resets forgotten passwords in the admin UI.
  users.passwordAuth.enabled = true
  users.passwordAuth.identityFields = ["email"]
  users.otp.enabled = false
  users.mfa.enabled = false
  users.oauth2.enabled = false
  users.authAlert.enabled = false
  users.authToken.duration = 30 * 24 * 60 * 60 // the app is offline-first; refreshed on each sync
  users.fields.getByName("password").min = 10
  users.fields.removeByName("name")
  users.fields.removeByName("avatar")
  users.listRule = "id = @request.auth.id"
  users.viewRule = "id = @request.auth.id"
  users.createRule = ""
  users.updateRule = "id = @request.auth.id"
  users.deleteRule = "id = @request.auth.id"
  app.save(users)

  const owner = { type: "relation", name: "user", required: true, collectionId: users.id, cascadeDelete: true, maxSelect: 1 }
  const timestamps = [
    { type: "autodate", name: "created", onCreate: true, onUpdate: false },
    { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
  ]

  app.save(new Collection({
    type: "base",
    name: "entries",
    ...OWNER_ONLY,
    fields: [
      owner,
      { type: "text", name: "date", required: true, pattern: DATE_PATTERN, min: 10, max: 10 },
      { type: "select", name: "flow", values: ["none", "spotting", "light", "medium", "heavy"], maxSelect: 1 },
      { type: "select", name: "symptoms", values: SYMPTOMS, maxSelect: SYMPTOMS.length },
      { type: "select", name: "mood", values: ["cry", "sad", "neutral", "smile", "happy"], maxSelect: 1 },
      { type: "text", name: "note", max: 10000 },
      { type: "json", name: "tags", maxSize: 4000 },
      { type: "number", name: "temperature", min: 34, max: 43 },
      { type: "bool", name: "tempDisturbed" },
      { type: "select", name: "mucus", values: ["dry", "sticky", "creamy", "watery", "eggwhite"], maxSelect: 1 },
      // Sync (T99): last write wins on updatedAt; a deleted day stays as a tombstone.
      { type: "number", name: "updatedAt", required: true, onlyInt: true, min: 0 },
      { type: "bool", name: "deleted" },
      ...timestamps,
    ],
    indexes: ["CREATE UNIQUE INDEX idx_entries_user_date ON entries (user, date)"],
  }))

  // One row per user: the settings that describe the person, not the device.
  // Device-only settings (PIN, lockout, theme, draft, onboarding, last backup)
  // never leave the phone.
  app.save(new Collection({
    type: "base",
    name: "cycle_settings",
    ...OWNER_ONLY,
    fields: [
      owner,
      { type: "text", name: "lastPeriodStart", pattern: DATE_PATTERN, max: 10 },
      { type: "number", name: "avgCycleLength", required: true, onlyInt: true, min: 15, max: 45 },
      { type: "number", name: "avgPeriodLength", required: true, onlyInt: true, min: 1, max: 14 },
      { type: "bool", name: "predictionsPaused" },
      { type: "json", name: "customTags", maxSize: 10000 },
      { type: "number", name: "birthYear", onlyInt: true, min: 1900, max: 2100 },
      { type: "bool", name: "perimenopauseMode" },
      { type: "bool", name: "fertilityAwareness" },
      { type: "select", name: "temperatureUnit", values: ["C", "F"], maxSelect: 1 },
      { type: "json", name: "confirmedLongCycles", maxSize: 10000 },
      { type: "number", name: "updatedAt", required: true, onlyInt: true, min: 0 },
      ...timestamps,
    ],
    indexes: ["CREATE UNIQUE INDEX idx_cycle_settings_user ON cycle_settings (user)"],
  }))

  const settings = app.settings()
  settings.meta.appName = "Moonflow"
  settings.meta.appURL = "https://moonflow.pockethost.io"
  app.save(settings)
}, (app) => {
  app.delete(app.findCollectionByNameOrId("cycle_settings"))
  app.delete(app.findCollectionByNameOrId("entries"))

  const users = app.findCollectionByNameOrId("users")
  users.fields.add(new TextField({ name: "name", max: 255 }))
  users.fields.add(new FileField({ name: "avatar", maxSelect: 1, mimeTypes: ["image/jpeg", "image/png", "image/svg+xml", "image/gif", "image/webp"] }))
  users.fields.getByName("password").min = 8
  users.authAlert.enabled = true
  users.authToken.duration = 432000
  app.save(users)
})
