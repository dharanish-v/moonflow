// T103 (ADR-055) — push reminders end to end on a throwaway PocketBase: the
// tick route sends each due reminder once, as an empty push with a valid
// VAPID Authorization header, to a fake push service running in this test.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const backend = new URL('..', import.meta.url).pathname;
const bin = join(backend, '.bin/pocketbase');
const port = 18000 + Math.floor(Math.random() * 1000);
const base = `http://127.0.0.1:${port}`;
const dir = mkdtempSync(join(tmpdir(), 'moonflow-push-'));
const pbArgs = ['--dir', dir, '--migrationsDir', join(backend, 'pb_migrations'), '--hooksDir', join(backend, 'pb_hooks')];
const TICK_KEY = 'test-tick-key';
const { subtle } = globalThis.crypto;
let server, push, pushBase, vapidPublic, admin;
const received = [];
const replyWith = new Map(); // path → status

async function api(method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function signUp(email) {
  const password = 'correct horse battery';
  await api('POST', '/api/collections/users/records', { body: { email, password, passwordConfirm: password } });
  const auth = await api('POST', '/api/collections/users/auth-with-password', { body: { identity: email, password } });
  return { id: auth.body.record.id, token: auth.body.token };
}

const tick = (key = TICK_KEY) => api('GET', `/api/moonflow/reminders/tick?key=${encodeURIComponent(key)}`);
const now = () => Math.floor(Date.now() / 1000);
let n = 0;
async function subscribe(user, reminders, status = 201) {
  const path = `/push/${++n}`;
  replyWith.set(path, status);
  const r = await api('POST', '/api/collections/push_subscriptions/records', { token: user.token, body: { user: user.id, endpoint: `${pushBase}${path}`, reminders } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return { ...r.body, path };
}
const pushesTo = (path) => received.filter((r) => r.path === path);

let a, b;

before(async () => {
  push = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      received.push({ path: req.url, headers: req.headers, body });
      res.statusCode = replyWith.get(req.url) ?? 201;
      res.end();
    });
  });
  await new Promise((r) => push.listen(0, '127.0.0.1', r));
  pushBase = `http://127.0.0.1:${push.address().port}`;

  const keys = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await subtle.exportKey('jwk', keys.privateKey);
  vapidPublic = keys.publicKey;

  execFileSync(bin, ['superuser', 'upsert', 'admin@test.local', 'admin-password-123', ...pbArgs], { stdio: 'ignore' });
  server = spawn(bin, ['serve', '--http', `127.0.0.1:${port}`, ...pbArgs], {
    stdio: 'ignore',
    env: { ...process.env, VAPID_PRIVATE_KEY: jwk.d, REMINDER_TICK_KEY: TICK_KEY },
  });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  admin = (await api('POST', '/api/collections/_superusers/auth-with-password', { body: { identity: 'admin@test.local', password: 'admin-password-123' } })).body.token;
  a = await signUp('a@test.local');
  b = await signUp('b@test.local');
});

after(() => {
  server?.kill();
  push?.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('tick route', () => {
  it('refuses callers without the key', async () => {
    assert.equal((await tick('wrong')).status, 403);
    assert.equal((await api('GET', '/api/moonflow/reminders/tick')).status, 403);
  });
});

describe('push_subscriptions rules', () => {
  it('is owner-only, and only the server may set sentUpTo', async () => {
    const sub = await subscribe(a, [now() + 3600]);
    assert.deepEqual((await api('GET', '/api/collections/push_subscriptions/records', { token: b.token })).body.items, []);
    assert.equal((await api('PATCH', `/api/collections/push_subscriptions/records/${sub.id}`, { token: b.token, body: { reminders: [] } })).status, 404);
    assert.notEqual((await api('PATCH', `/api/collections/push_subscriptions/records/${sub.id}`, { token: a.token, body: { sentUpTo: 9999999999 } })).status, 200);
    assert.equal((await api('PATCH', `/api/collections/push_subscriptions/records/${sub.id}`, { token: a.token, body: { reminders: [now() + 7200] } })).status, 200);
  });

  it('validates the reminder list', async () => {
    for (const reminders of [Array.from({ length: 13 }, (_, i) => now() + i + 1), [1.5], ['soon'], 'x']) {
      const r = await api('POST', '/api/collections/push_subscriptions/records', { token: a.token, body: { user: a.id, endpoint: `${pushBase}/v/${++n}`, reminders } });
      assert.equal(r.status, 400, `accepted ${JSON.stringify(reminders)}`);
    }
  });
});

describe('sending', () => {
  it('sends a due reminder once, as an empty push with a valid VAPID header', async () => {
    const sub = await subscribe(a, [now() - 60, now() + 86400]);
    const r = await tick();
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const pushes = pushesTo(sub.path);
    assert.equal(pushes.length, 1);
    const p = pushes[0];
    assert.equal(p.body, '');
    assert.equal(p.headers.ttl, '86400');
    const m = p.headers.authorization.match(/^vapid t=([^,]+), k=(\S+)$/);
    assert.ok(m, p.headers.authorization);
    const [h, c, s] = m[1].split('.');
    const claims = JSON.parse(Buffer.from(c, 'base64url'));
    assert.deepEqual(JSON.parse(Buffer.from(h, 'base64url')), { typ: 'JWT', alg: 'ES256' });
    assert.equal(claims.aud, pushBase);
    assert.equal(claims.sub, 'https://github.com/dharanish-v/moonflow');
    assert.ok(claims.exp > now() && claims.exp <= now() + 24 * 3600);
    assert.ok(await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, vapidPublic, Buffer.from(s, 'base64url'), Buffer.from(`${h}.${c}`)));
    const k = Buffer.from(m[2], 'base64url');
    assert.deepEqual(k, Buffer.from(await subtle.exportKey('raw', vapidPublic)));

    await tick();
    assert.equal(pushesTo(sub.path).length, 1, 'sent twice');
  });

  it('does not send future reminders, and skips ones more than 12 h late', async () => {
    const future = await subscribe(a, [now() + 3600]);
    const stale = await subscribe(a, [now() - 13 * 3600]);
    await tick();
    assert.equal(pushesTo(future.path).length, 0);
    assert.equal(pushesTo(stale.path).length, 0);
    const row = (await api('GET', `/api/collections/push_subscriptions/records/${stale.id}`, { token: admin })).body;
    assert.ok(row.sentUpTo > 0, 'stale reminder not marked done');
  });

  it('deletes a subscription the push service says is gone, and retries a failed one', async () => {
    const gone = await subscribe(b, [now() - 30], 410);
    const flaky = await subscribe(b, [now() - 30], 500);
    await tick();
    assert.equal((await api('GET', `/api/collections/push_subscriptions/records/${gone.id}`, { token: admin })).status, 404);
    replyWith.set(flaky.path, 201);
    await tick();
    assert.equal(pushesTo(flaky.path).length, 2);
    await tick();
    assert.equal(pushesTo(flaky.path).length, 2);
  });

  it('reuses one signed token per push service', async () => {
    const one = await subscribe(a, [now() - 10]);
    const two = await subscribe(b, [now() - 10]);
    await tick();
    const t = (path) => pushesTo(path)[0].headers.authorization;
    assert.equal(t(one.path), t(two.path));
  });

  it('deleting the account deletes its subscriptions', async () => {
    const c = await signUp('c@test.local');
    const sub = await subscribe(c, [now() + 3600]);
    await api('DELETE', `/api/collections/users/records/${c.id}`, { token: c.token });
    assert.equal((await api('GET', `/api/collections/push_subscriptions/records/${sub.id}`, { token: admin })).status, 404);
  });
});
