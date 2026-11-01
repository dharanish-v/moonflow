# Moonflow backend (PocketHost)

Optional accounts and sync (ADR-053). Everything the instance runs lives here as code:

- `pb_hooks/` — PocketBase JS hooks (goja runtime: CommonJS only, no Node or browser APIs)
- `pb_migrations/` — schema, access rules and auth settings as JS migrations (format: `docs/data-format.md` §6)
- `test/` — rule tests: run the migrations and hooks on a throwaway local PocketBase and check every user sees only their own data

Deployed with [`phio`](https://pockethost.io/docs/phio) over SFTP. `pb_data/` is never synced.

## Setup (once)

```bash
npm install -g phio tsx   # phio 0.4.0 runs through tsx, which it doesn't put on PATH itself
phio login                # your PocketHost email + password; file sync then uses an Ed25519 deploy key
cd apps/moonflow-backend
phio link <instance>      # writes .phioconfig
```

## Test

```bash
cd apps/moonflow-backend
./scripts/fetch-pocketbase.sh        # pinned PocketBase (same minor as the instance) into .bin/, checksum-verified
node --test 'test/**/*.test.mjs'
```

pre-push and CI run these before any deploy.

## Deploy

```bash
cd apps/moonflow-backend
phio deploy -v
curl https://<instance>.pockethost.io/api/moonflow/health
phio logs                 # tail instance logs
```

## Push reminder secrets and webhook (ADR-055)

`scripts/configure-push.mts` sets `VAPID_PRIVATE_KEY`, `REMINDER_TICK_KEY` and the every-minute tick webhook through phio's login (the same API call the dashboard makes). It reads a local env file and never prints a secret:

```bash
tsx scripts/configure-push.mts ~/.config/moonflow-push/secrets.env
```

To rotate keys: generate new ones, update `src/lib/push-config.ts` in the app with the new public key, run the script, release. Existing subscriptions were made with the old public key, so devices need to turn notifications off and on again.

## Dashboard-only settings

PocketHost has no CLI for these. Set them in the dashboard and note them here:

- PocketBase version: `0.40.*` (upgraded from 0.22 on 2026-11-01, after the instance's old vehicle/owner data was backed up locally and cleared)
- Webhooks and secrets: the dashboard, or `scripts/configure-push.mts` for the push ones
