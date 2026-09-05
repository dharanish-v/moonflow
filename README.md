# Moonflow

A private, local-only period tracker. No account, no server, no data leaving your phone.

## Repo layout

```
apps/moonflow-pwa/   the app — plain HTML/CSS/JS, no build step (see ADR-014)
docs/                planning docs (this map, below)
```

Structured as a monorepo (`apps/`) in case the V2 push-reminder relay (see `docs/task-board.md`'s backlog) ever gets built as a second app — nothing about the PWA's own no-build, no-Node approach changes either way (see ADR-028).

## Documentation map
- `docs/prd.md` — what this solves, for whom, and what "done" looks like
- `docs/adr-log.md` — why each technical decision was made (immutable history)
- `docs/design-system.md` — palette, type, spacing, components, screens, edge cases
- `docs/technical-design.md` — schema, state shape, file structure, algorithms
- `docs/qa-checklist.md` — manual verification before calling V1 done
- `docs/copy-deck.md` — every user-facing string, tone guide, privacy statement
- `docs/task-board.md` — phase-by-phase build log, bugs found and fixed along the way
- `apps/moonflow-pwa/tests/` — one plain HTML page per module, open directly in a browser (see ADR-014 — no test runner)

## Local development

No build step — it's plain HTML/CSS/JS. Serve `apps/moonflow-pwa/` with any static file server. macOS/Linux already has Python installed, so no extra install is needed:
```
cd apps/moonflow-pwa
python3 -m http.server 8000
```
(A local server is required, not optional — service workers and ES modules both refuse to work over a plain `file://` URL.)
Open the printed `http://localhost:...` URL in a desktop browser for quick iteration. Native features (Add to Home Screen, the Share Sheet, PIN lock persistence) only behave correctly on an actual iPhone in Safari, so test those on-device.

## Deploying

Any static host works, since there's no server code (Vercel, Netlify, GitHub Pages, Cloudflare Pages — pick whichever is easiest). Deploy `apps/moonflow-pwa/` as-is; HTTPS is required for the service worker and install prompt to work at all.

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

1. Make your changes.
2. Bump the `CACHE_VERSION` constant at the top of `apps/moonflow-pwa/service-worker.js` (e.g. `v3` → `v4`) — this is what makes the old cached version actually get replaced instead of silently persisting.
3. Redeploy. The next time the app is opened (even offline-first), the new service worker installs and takes over on the following launch.

## Data & backup

Everything lives in IndexedDB on-device. Use **Settings → Export data** to save a JSON backup — this is the only way to move data to a new phone, since there's no sync (see ADR-002).
