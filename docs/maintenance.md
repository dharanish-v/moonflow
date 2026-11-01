# Keeping Moonflow working, for years

Moonflow v1.0.0 is feature-frozen (ADR-052). It has no server, no account and no network dependency at runtime, so it keeps working as long as iOS supports home-screen web apps and the phone keeps its data. This page is the whole maintenance routine.

## Once a year (about 10 minutes)

1. Open the app and check that Home, Calendar, Insights and Settings all look right.
2. **Settings → Export data → encrypted backup.** Save it somewhere you keep for years (Files → iCloud Drive, a computer). Check that Settings now says "Backed up today".
3. Once a year, import that backup on a spare device or a new install, to prove it restores.
4. Glance at `docs/qa-checklist.md`'s "on-device only" list if anything felt off.

## After each major iOS release (every September)

Web apps rarely break, but check these, the parts that depend on Safari:

- The app launches from the home-screen icon, offline too (airplane mode).
- The date wheel opens in onboarding (the native `<input type="date">`).
- Text follows Settings → Display → Text Size (Dynamic Type).
- Export opens the Share Sheet; importing an encrypted backup works.
- The calendar swipe changes months; view transitions still animate (or simply change instantly, which is harmless).

If something broke, it's Safari changing behaviour. Look at the failing feature, fix it on a branch, run the full gate (below), and deploy. Change nothing else.

## Rebuilding exactly (e.g. years later, or on another machine)

Everything is pinned: exact dependency versions in `package.json`, the lockfile, and `engines.node`.

```bash
git checkout v1.0.0            # or the release you want
cd apps/moonflow-pwa-react
npm ci                         # installs exactly the locked versions
npx tsc -b && npm run lint && npm test && VITE_ACCOUNTS=1 npm run build   # v1.1.0+: accounts on, as CI builds it
```

If npm or the old dependencies are ever unavailable, you don't need to build at all: every GitHub Release has the finished app attached (`moonflow-vX.Y.Z-dist.zip`, plus `SHA256SUMS`). Unzip it and serve the folder from any static host over HTTPS.

## If the host disappears

- **Installed phones keep working offline.** The service worker serves the app from the phone's cache. This was verified with the host fully gone, and with `service-worker.js` returning 404 (ADR-048).
- **New installs need a host.** Upload the release zip to any static host (GitHub Pages, Cloudflare Pages, Netlify, your own server).
- ⚠️ **The address is the data's key.** A different address is a different, empty app on the phone. Moving means: export a backup in the old app, install from the new address, import there. Face ID passkeys (if ever added) are tied to the address too.
- ⚠️ **Never rename or delete the GitHub account (or org) that owns the address.** Someone else could claim the name, serve their own code at the same address, and read the data in installed apps.

## The sync server (v1.1.0 and later)

Accounts are optional (ADR-053). Without one, everything above still holds and nothing depends on a server. With one, logs sync through a PocketBase instance on PocketHost (`apps/moonflow-backend`, ADR-054).

- **If PocketHost goes away:** sync stops; every phone keeps all its data and keeps working. Settings → Account shows "Waiting to sync". Moving: set up PocketBase elsewhere from `apps/moonflow-backend` (migrations and hooks are all there), change `src/lib/backend-url.ts`, release, and everyone signs in again (their phones still have their data, and the first sync re-uploads it).
- **Forgotten password:** there's no email. Reset it in the admin UI (`https://moonflow.pockethost.io/_/` → users → set a new password).
- **Once a year:** open Settings → Account on your phone and check it says "Synced …". Check the PocketHost dashboard still shows the instance on a supported PocketBase version; a version change needs the backend tests (`node --test` in `apps/moonflow-backend`) to pass against the new version first.
- **Never** put the superuser password, phio credentials or the deploy key anywhere but the GitHub secrets and your own machine.

## Changing anything

The gate every change must pass, as CI does on every push to `main`:

```bash
npx tsc -b && npm run lint && npm test && LANG=en_US.UTF-8 TZ=UTC npm test && npm run build
```

The `pre-push` git hook runs this for you once hooks are enabled (`git config core.hooksPath .githooks`).

Ship a new version by bumping `version` in `package.json`, tagging `vX.Y.Z`, and attaching the new dist zip and `SHA256SUMS` to a release. Installed apps show "A new version is ready — Update"; nothing changes on a phone until that button is tapped.

Dependency policy after the freeze: **no updates except security fixes**, each through the full gate.

## Open decision

- **The permanent address** is still `https://dharanish-v.github.io/moonflow/` (ADR-042). A free GitHub org would give Moonflow an address of its own. Decide before adding Face ID/passkeys.
