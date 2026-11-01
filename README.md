# Moonflow

**v1.0.0: feature-complete and frozen** (see `docs/maintenance.md`).

A private, local-only period tracker for iPhone. No account, no server, and no data leaves your phone: the page's Content Security Policy blocks every network request.

It installs as a home-screen web app, so there's no App Store and no Apple developer account.

## Install on iPhone

- **Normal icon:** https://dharanish-v.github.io/moonflow/index.html
- **Discreet "Planner" icon:** https://dharanish-v.github.io/moonflow/planner.html

1. Open the link in **Safari**. In-app browsers such as WhatsApp's can't install web apps; use "Open in Safari".
2. Tap **Share → Add to Home Screen**, then open it from the home screen.

Things to know:

- **Each home-screen icon keeps its own data.** Anything entered in a Safari tab stays in that tab.
- **Removing the icon deletes its data.** Export a backup first (Settings → Export data).
- **The icon identity is chosen at install.** To switch between Moonflow and Planner, remove the icon and install from the other link.

## What it does

- **Logging:** flow, symptoms, mood, custom tags and notes, for any past day. On Home, one tap logs "Period started today" or "Still on my period", with Undo.
- **Predictions:** built from your last 6 valid cycles, always shown as a range. Irregular cycles are flagged, a missed log is detected, and a period past its range shows as "late · N days". The fertile window is shown as an estimate only; it is **not** birth control. Predictions can be paused (pregnancy, breastfeeding, hormonal birth control).
- **Insights:** cycle and period averages, when symptoms usually show up, calm health notes based on the FIGO criteria, search across all logs, and a printable report for a doctor.
- **Privacy:** a PIN lock (salted PBKDF2), a duress PIN that opens an empty decoy, "Erase all data", and a blank app-switcher snapshot.
- **Backups:** encrypted by default (AES-256-GCM), with a readable CSV option. Calendar reminders come from an `.ics` file, so no server is involved.

## Repo layout

```
apps/moonflow-pwa-react/   the app — React 19, TypeScript, Vite, Tailwind v4, shadcn/ui, Dexie
apps/moonflow-backend/     optional accounts and sync — PocketBase on PocketHost (ADR-053)
.githooks/                 pre-commit and pre-push checks
docs/                      product and engineering docs (below)
```

## Development

```bash
git config core.hooksPath .githooks   # once per clone: enables the git hooks below
cd apps/moonflow-pwa-react
npm ci
npm run dev        # dev server
VITE_ACCOUNTS=1 npm run dev   # with the optional account (ADR-053), as production builds have it since v1.1.0
npm test           # Vitest: unit, screen, a11y and build-guard tests
npm run lint       # oxlint
npx tsc -b         # typecheck
npm run build      # production build → dist/ (index.html + planner.html)
npm run preview    # serve the build, including the service worker
```

Git hooks in `.githooks/` (plain shell, no dependency). Skip the blocking ones once with `--no-verify`.

| Hook | Does |
|---|---|
| pre-commit | Blocks staged keys and tokens. Lint + typecheck when app files are staged; `node --check` on backend hooks and migrations |
| pre-merge-commit | Same checks for merges that create a commit |
| prepare-commit-msg | On a ticket branch (`t97-…`) starts the message with `T97: ` |
| commit-msg | Subject under 100 characters; no `fixup!`, `squash!` or `WIP` commits on main |
| post-commit | Says how many commits main is ahead of origin (pushing main deploys) |
| pre-rebase | Refuses to rebase commits already pushed (`git pull --rebase` still works) |
| post-merge, post-rewrite, post-checkout | After a pull, rebase or branch switch, runs `npm ci` if `package-lock.json` changed |
| pre-push | Refuses to delete or force-push main. Runs the full gate below for whatever the push changes |

Every push to `main` runs the tests, lint and build in CI (`.github/workflows/deploy-pages.yml`), then deploys to GitHub Pages.

Test on a real iPhone for installation, the Share Sheet, VoiceOver, Dynamic Type and the calendar swipe; see `docs/qa-checklist.md`.

## Documentation

- `docs/prd.md`: the problem, the user, and what done means.
- `docs/adr-log.md`: why each decision was made. It's append-only; ADR-034 to ADR-045 cover the 2026-09 audit.
- `docs/design-system.md`: palette, type, components and screens.
- `docs/technical-design.md`: data model, forecast engine and file map.
- `docs/qa-checklist.md`: manual on-device checks.
- `docs/copy-deck.md`: user-facing strings and tone.
- `docs/task-board.md`: the build log, phase by phase.
- `docs/data-format.md`: every file format the app writes, field by field, so the data stays readable without the app.
- `docs/maintenance.md`: the yearly routine, post-iOS-update checks, exact rebuild steps, and what to do if the host disappears.
