# Moonflow (React + TypeScript rewrite)

A full rewrite of the vanilla-JS Moonflow PWA (`../moonflow-pwa/`) in React 19
+ TypeScript, shadcn/ui, Framer Motion, and React Three Fiber. Same product:
a local-only, offline-first period tracker — no backend, no accounts, no
cloud sync.

See `../../docs/rewrite-migration-checklist.md` for what changed, what was
re-verified from the vanilla app's ADR log, and every real bug found during
the rewrite's own live testing.

## Stack

- **Vite** + **React 19** + **TypeScript** (strict mode)
- **Tailwind v4** + **shadcn/ui** (Radix UI primitives) for components
- **Framer Motion** for animation and gestures
- **React Three Fiber** for Home's real 3D moon-phase illustration (lazy-loaded, WebGL2/reduced-motion-gated, with a 2D SVG fallback)
- **react-router-dom** (`HashRouter`) for real, deep-linkable per-screen URLs — hash-based, since this deploys to a static host with no server-side rewrite rule
- **Dexie** (IndexedDB) — unchanged DB name/schema from the vanilla app, so on-device data carries over on a same-origin deploy
- **Vitest** + **React Testing Library** + **jest-axe** + **fake-indexeddb** for testing
- **vite-plugin-pwa** (`generateSW`) for the service worker

## Commands

```bash
npm run dev       # dev server
npm test          # vitest run — full suite, CI-friendly
npm run test:watch
npx tsc -b        # typecheck
npm run build     # production build (both index.html and planner.html entries)
npm run preview   # serve the production build locally
```

## Two install identities

Like the vanilla app (ADR-011), this builds two HTML entries sharing one JS
bundle: `index.html` (Moonflow) and `planner.html` (a neutral "Planner"
identity with its own manifest/icon, for a discreet home-screen icon). See
`vite.config.ts`'s `build.rollupOptions.input`.
