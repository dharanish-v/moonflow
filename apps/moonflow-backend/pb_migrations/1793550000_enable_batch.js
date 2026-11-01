/// <reference path="../pb_data/types.d.ts" />
// T99 (ADR-054) — sync pushes up to 50 days per request through the batch
// API, to stay under PocketHost's 50 requests per 10 s per IP. Each request
// in a batch still goes through the collection's access rules.
migrate((app) => {
  const settings = app.settings()
  settings.batch.enabled = true
  settings.batch.maxRequests = 50
  app.save(settings)
}, (app) => {
  const settings = app.settings()
  settings.batch.enabled = false
  app.save(settings)
})
