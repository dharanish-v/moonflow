/// <reference path="../pb_data/types.d.ts" />
// T97 — reject malformed JSON fields on every API write. Handlers run
// isolated, so each one requires the shared checks itself.

onRecordCreateRequest((e) => {
  require(`${__hooks}/lib/validate.js`).entry(e.record)
  e.next()
}, "entries")

onRecordUpdateRequest((e) => {
  require(`${__hooks}/lib/validate.js`).entry(e.record)
  e.next()
}, "entries")

onRecordCreateRequest((e) => {
  require(`${__hooks}/lib/validate.js`).cycleSettings(e.record)
  e.next()
}, "cycle_settings")

onRecordUpdateRequest((e) => {
  require(`${__hooks}/lib/validate.js`).cycleSettings(e.record)
  e.next()
}, "cycle_settings")

onRecordCreateRequest((e) => {
  require(`${__hooks}/lib/validate.js`).pushSubscription(e.record)
  e.next()
}, "push_subscriptions")

onRecordUpdateRequest((e) => {
  require(`${__hooks}/lib/validate.js`).pushSubscription(e.record)
  e.next()
}, "push_subscriptions")
