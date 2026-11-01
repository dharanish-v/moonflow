# Moonflow backend (PocketHost)

Optional accounts and sync (ADR-053). Everything the instance runs lives here as code:

- `pb_hooks/` — PocketBase JS hooks (goja runtime: CommonJS only, no Node or browser APIs)
- `pb_migrations/` — schema, access rules and auth settings as JS migrations

Deployed with [`phio`](https://pockethost.io/docs/phio) over SFTP. `pb_data/` is never synced.

## Setup (once)

```bash
npm install -g phio tsx   # phio 0.4.0 runs through tsx, which it doesn't put on PATH itself
phio login                # your PocketHost email + password; file sync then uses an Ed25519 deploy key
cd apps/moonflow-backend
phio link <instance>      # writes .phioconfig
```

## Deploy

```bash
cd apps/moonflow-backend
phio deploy -v
curl https://<instance>.pockethost.io/api/moonflow/health
phio logs                 # tail instance logs
```

## Dashboard-only settings

PocketHost has no CLI for these. Set them in the dashboard and note them here:

- PocketBase version: `0.40.*` (upgraded from 0.22 on 2026-11-01, after the instance's old vehicle/owner data was backed up locally and cleared)
- Webhooks (scheduled calls; they run even while the instance hibernates)
- Secrets / environment variables
