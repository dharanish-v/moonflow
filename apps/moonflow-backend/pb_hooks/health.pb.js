/// <reference path="../pb_data/types.d.ts" />
// T96 — proves a deploy reached the instance: GET /api/moonflow/health.
// Bump `build` when you need to tell two deploys apart.
routerAdd("GET", "/api/moonflow/health", (e) => {
  return e.json(200, { ok: true, app: "moonflow-backend", build: 1 })
})
