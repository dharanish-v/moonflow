// Sets the push-reminder secrets and the every-minute tick webhook on the
// PocketHost instance (ADR-055), using phio's saved login — the same
// PUT /api/instance/{id} call the dashboard makes. Never prints a secret.
//
//   npm i -g phio tsx && phio login
//   tsx scripts/configure-push.mts [path/to/secrets.env]
//
// secrets.env holds VAPID_PRIVATE_KEY=… and REMINDER_TICK_KEY=… lines.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const INSTANCE = 'moonflow';
const TICK_PATH = '/api/moonflow/reminders/tick';

const phio = join(execSync('npm root -g').toString().trim(), 'phio/src/lib');
const { getClient, getInstanceBySubdomainCnameOrId } = await import(join(phio, 'getClient.ts'));
const { PHIO_MOTHERSHIP_URL } = await import(join(phio, 'constants.ts'));

const file = process.argv[2] ?? join(homedir(), '.config/moonflow-push/secrets.env');
const wanted = Object.fromEntries(
  readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
for (const k of ['VAPID_PRIVATE_KEY', 'REMINDER_TICK_KEY']) {
  if (!wanted[k]) throw new Error(`${k} missing from ${file}`);
}

const client = await getClient();
const instance = await getInstanceBySubdomainCnameOrId(INSTANCE);
const secrets = { ...(instance.secrets ?? {}), VAPID_PRIVATE_KEY: wanted.VAPID_PRIVATE_KEY, REMINDER_TICK_KEY: wanted.REMINDER_TICK_KEY };
const webhooks = [
  ...((instance.webhooks ?? []) as Array<{ endpoint: string; value: string }>).filter((w) => !w.endpoint.startsWith(TICK_PATH)),
  { endpoint: `${TICK_PATH}?key=${encodeURIComponent(wanted.REMINDER_TICK_KEY)}`, value: '* * * * *' },
];

const res = await fetch(`${PHIO_MOTHERSHIP_URL()}/api/instance/${instance.id}`, {
  method: 'PUT',
  headers: { 'content-type': 'application/json', authorization: client.authStore.token },
  body: JSON.stringify({ id: instance.id, fields: { secrets, webhooks } }),
});
console.log(`PUT /api/instance/${instance.id}: HTTP ${res.status} ${res.ok ? '' : await res.text()}`);

const after = await getInstanceBySubdomainCnameOrId(INSTANCE);
console.log(`secrets now: ${Object.keys(after.secrets ?? {}).join(', ') || '(none)'}`);
console.log(
  `webhooks now: ${
    (after.webhooks ?? [])
      .map((w: { endpoint: string; value: string }) => `${w.endpoint.replace(/key=[^&]+/, 'key=***')} @ "${w.value}"`)
      .join('; ') || '(none)'
  }`,
);
