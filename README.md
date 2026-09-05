# Moonflow

A private, local-only period tracker. No account, no server, no data leaving your phone.

## Repo layout

```
apps/moonflow-pwa/   the app — vanilla JS, built with Vite + Tailwind v4 + GSAP (see ADR-029)
docs/                planning docs (this map, below)
```

Structured as a monorepo (`apps/`) in case the V2 push-reminder relay (see `docs/task-board.md`'s backlog) ever gets built as a second app (see ADR-028).

## Documentation map
- `docs/prd.md` — what this solves, for whom, and what "done" looks like
- `docs/adr-log.md` — why each technical decision was made (immutable history)
- `docs/design-system.md` — palette, type, spacing, components, screens, edge cases
- `docs/technical-design.md` — schema, state shape, file structure, algorithms
- `docs/qa-checklist.md` — manual verification before calling V1 done
- `docs/copy-deck.md` — every user-facing string, tone guide, privacy statement
- `docs/task-board.md` — phase-by-phase build log, bugs found and fixed along the way
- `apps/moonflow-pwa/tests/` — one plain HTML page per module, no test runner — open directly via the dev server (see below)

## Local development

```
cd apps/moonflow-pwa
npm install
npm run dev
```
Open the printed `http://localhost:5173/` URL (`index.html`/`planner.html`) for quick iteration, or `http://localhost:5173/tests/whatever-tests.html` to run any test file directly — results render right on the page, no runner or reporter needed. Native features (Add to Home Screen, the Share Sheet, PIN lock persistence) only behave correctly on an actual iPhone in Safari, so test those on-device.

`npm run build` produces a production build in `apps/moonflow-pwa/dist/`; `npm run preview` serves that build locally exactly as it will be deployed (useful for testing the service worker/offline behavior, which the dev server doesn't exercise the same way).

## Deploying

Any static host works (Vercel, Netlify, GitHub Pages, Cloudflare Pages — pick whichever is easiest), but a build step is now required first: run `npm run build` inside `apps/moonflow-pwa/` and deploy the resulting `dist/` folder, not the source tree. HTTPS is required for the service worker and install prompt to work at all.

## The two install links

`index.html` / `manifest.json` → the real Moonflow icon and name.
`planner.html` / `manifest-discreet.json` → the discreet "Planner" icon and name.

Share whichever link matches the icon you want (see ADR-011 — this can't be switched later without reinstalling, since it's fixed at install time).

**Live (GitHub Pages, deployed via `.github/workflows/deploy-pages.yml` on every push to `main`):**
- Real icon: https://dharanish-v.github.io/moonflow/index.html
- Discreet icon: https://dharanish-v.github.io/moonflow/planner.html

The repo is public (GitHub Pages doesn't support private repos on the free plan — see ADR-023). No user data is ever in the repo or the deployed site regardless; everything logged lives only in each install's own on-device IndexedDB.

## Installing on iPhone

1. Send the install link via WhatsApp/Telegram.
2. On iPhone, tap the link, then tap the "•••" or Share icon and choose **Open in Safari** — the in-app browser can't install PWAs.
3. In Safari, tap the Share icon → **Add to Home Screen**.

## Shipping an update

Just make your changes and redeploy — the service worker (`vite-plugin-pwa`, `apps/moonflow-pwa/vite.config.js`) is regenerated fresh on every `npm run build`, with a content-hashed precache manifest that changes automatically whenever any file's contents change, so there's no manual version constant to remember to bump anymore (see ADR-029; superseded the old hand-maintained `CACHE_VERSION`/`PRECACHE_FILES` approach in `service-worker.js`, which no longer exists as a source file). The next time the app is opened (even offline-first), the new service worker installs and takes over on the following launch.

## Data & backup

Everything lives in IndexedDB on-device. Use **Settings → Export data** to save a JSON backup — this is the only way to move data to a new phone, since there's no sync (see ADR-002).
