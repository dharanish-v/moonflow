/// <reference path="../pb_data/types.d.ts" />
// T103 (ADR-055) — one row per device that wants push reminders: where to
// push, when, and how far it has sent. No payload is ever sent, so the
// subscription's encryption keys aren't stored.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  app.save(new Collection({
    type: "base",
    name: "push_subscriptions",
    listRule: "user = @request.auth.id",
    viewRule: "user = @request.auth.id",
    createRule: "@request.auth.id != '' && user = @request.auth.id",
    updateRule: "user = @request.auth.id && (@request.body.user:isset = false || @request.body.user = @request.auth.id) && @request.body.sentUpTo:isset = false",
    deleteRule: "user = @request.auth.id",
    fields: [
      { type: "relation", name: "user", required: true, collectionId: users.id, cascadeDelete: true, maxSelect: 1 },
      { type: "url", name: "endpoint", required: true },
      // Unix seconds, ascending: when to remind (at most 12).
      { type: "json", name: "reminders", maxSize: 2000 },
      // Unix seconds of the last reminder sent. Only the server sets it.
      { type: "number", name: "sentUpTo", onlyInt: true, min: 0 },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_push_endpoint ON push_subscriptions (endpoint)"],
  }))
}, (app) => {
  app.delete(app.findCollectionByNameOrId("push_subscriptions"))
})
