// T97 — runs the real migrations and hooks on a throwaway PocketBase (the
// pinned version from scripts/fetch-pocketbase.sh) and checks that every user
// sees and changes only their own data. Run: node --test test/
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const backend = new URL('..', import.meta.url).pathname;
const bin = join(backend, '.bin/pocketbase');
const port = 18000 + Math.floor(Math.random() * 1000);
const base = `http://127.0.0.1:${port}`;
const dir = mkdtempSync(join(tmpdir(), 'moonflow-pb-'));
const pbArgs = ['--dir', dir, '--migrationsDir', join(backend, 'pb_migrations'), '--hooksDir', join(backend, 'pb_hooks')];
let server;

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
  const created = await api('POST', '/api/collections/users/records', { body: { email, password, passwordConfirm: password } });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const auth = await api('POST', '/api/collections/users/auth-with-password', { body: { identity: email, password } });
  assert.equal(auth.status, 200, JSON.stringify(auth.body));
  return { id: auth.body.record.id, token: auth.body.token };
}

const entry = (user, date, extra = {}) => ({ user, date, flow: 'medium', symptoms: ['cramps'], mood: 'neutral', note: 'n', tags: ['Ibuprofen'], updatedAt: 1, ...extra });
const settings = (user, extra = {}) => ({ user, avgCycleLength: 28, avgPeriodLength: 5, updatedAt: 1, ...extra });

let a, b, admin;

before(async () => {
  execFileSync(bin, ['superuser', 'upsert', 'admin@test.local', 'admin-password-123', ...pbArgs], { stdio: 'ignore' });
  server = spawn(bin, ['serve', '--http', `127.0.0.1:${port}`, ...pbArgs], { stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  const su = await api('POST', '/api/collections/_superusers/auth-with-password', { body: { identity: 'admin@test.local', password: 'admin-password-123' } });
  admin = su.body.token;
  a = await signUp('a@test.local');
  b = await signUp('b@test.local');
});

after(() => {
  server?.kill();
  rmSync(dir, { recursive: true, force: true });
});

describe('accounts', () => {
  it('rejects passwords under 10 characters', async () => {
    const r = await api('POST', '/api/collections/users/records', { body: { email: 'short@test.local', password: 'ninechars', passwordConfirm: 'ninechars' } });
    assert.equal(r.status, 400);
  });

  it('lets a user see only their own account', async () => {
    const r = await api('GET', '/api/collections/users/records', { token: a.token });
    assert.deepEqual(r.body.items.map((u) => u.id), [a.id]);
    assert.equal((await api('GET', `/api/collections/users/records/${b.id}`, { token: a.token })).status, 404);
  });

  it('has no name or avatar fields and no email codes', async () => {
    const r = await api('GET', '/api/collections/users', { token: admin });
    const names = r.body.fields.map((f) => f.name);
    assert.ok(!names.includes('name') && !names.includes('avatar'));
    assert.equal(r.body.otp.enabled, false);
    assert.equal(r.body.authAlert.enabled, false);
  });
});

describe('entries', () => {
  let rowA;

  before(async () => {
    const r = await api('POST', '/api/collections/entries/records', { token: a.token, body: entry(a.id, '2026-09-10') });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    rowA = r.body;
  });

  it('keeps one user out of another user’s days', async () => {
    assert.deepEqual((await api('GET', '/api/collections/entries/records', { token: b.token })).body.items, []);
    assert.equal((await api('GET', `/api/collections/entries/records/${rowA.id}`, { token: b.token })).status, 404);
    assert.equal((await api('PATCH', `/api/collections/entries/records/${rowA.id}`, { token: b.token, body: { note: 'x' } })).status, 404);
    assert.equal((await api('DELETE', `/api/collections/entries/records/${rowA.id}`, { token: b.token })).status, 404);
  });

  it('refuses to create a day for someone else, or without signing in', async () => {
    assert.notEqual((await api('POST', '/api/collections/entries/records', { token: b.token, body: entry(a.id, '2026-09-11') })).status, 200);
    assert.notEqual((await api('POST', '/api/collections/entries/records', { body: entry(a.id, '2026-09-12') })).status, 200);
    assert.deepEqual((await api('GET', '/api/collections/entries/records')).body.items, []);
  });

  it('refuses to hand a day to another user', async () => {
    const r = await api('PATCH', `/api/collections/entries/records/${rowA.id}`, { token: a.token, body: { user: b.id } });
    assert.notEqual(r.status, 200);
  });

  it('allows one row per user per date', async () => {
    assert.equal((await api('POST', '/api/collections/entries/records', { token: a.token, body: entry(a.id, '2026-09-10') })).status, 400);
    assert.equal((await api('POST', '/api/collections/entries/records', { token: b.token, body: entry(b.id, '2026-09-10') })).status, 200);
  });

  it('validates fields against docs/data-format.md', async () => {
    const bad = [
      { flow: 'gushing' },
      { mood: 'angry' },
      { symptoms: ['cramps', 'sneezing'] },
      { mucus: 'thick' },
      { temperature: 50 },
      { note: 'x'.repeat(10001) },
      { tags: Array.from({ length: 31 }, (_, i) => `t${i}`) },
      { tags: ['x'.repeat(41)] },
      { tags: [''] },
      { tags: 'not-a-list' },
    ];
    for (const extra of bad) {
      const r = await api('POST', '/api/collections/entries/records', { token: a.token, body: entry(a.id, '2026-08-01', extra) });
      assert.equal(r.status, 400, `accepted ${JSON.stringify(extra)}`);
    }
    for (const date of ['2026-9-1', 'yesterday']) {
      const r = await api('POST', '/api/collections/entries/records', { token: a.token, body: entry(a.id, date) });
      assert.equal(r.status, 400, `accepted date ${date}`);
    }
  });

  it('accepts a full day, an empty day and a tombstone', async () => {
    const full = entry(a.id, '2026-09-14', { temperature: 36.45, tempDisturbed: true, mucus: 'eggwhite', symptoms: ['hot_flashes', 'brain_fog'] });
    assert.equal((await api('POST', '/api/collections/entries/records', { token: a.token, body: full })).status, 200);
    const empty = { user: a.id, date: '2026-09-15', updatedAt: 2 };
    assert.equal((await api('POST', '/api/collections/entries/records', { token: a.token, body: empty })).status, 200);
    const r = await api('PATCH', `/api/collections/entries/records/${rowA.id}`, { token: a.token, body: { deleted: true, updatedAt: 3 } });
    assert.equal(r.status, 200);
    assert.equal(r.body.deleted, true);
  });
});

describe('cycle_settings', () => {
  it('allows exactly one row per user, owned by that user', async () => {
    const first = await api('POST', '/api/collections/cycle_settings/records', { token: a.token, body: settings(a.id, { customTags: ['Pill'], confirmedLongCycles: ['2026-06-01'] }) });
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal((await api('POST', '/api/collections/cycle_settings/records', { token: a.token, body: settings(a.id) })).status, 400);
    assert.deepEqual((await api('GET', '/api/collections/cycle_settings/records', { token: b.token })).body.items, []);
    assert.equal((await api('GET', `/api/collections/cycle_settings/records/${first.body.id}`, { token: b.token })).status, 404);
  });

  it('validates ranges and lists', async () => {
    const bad = [
      { avgCycleLength: 50 },
      { avgPeriodLength: 0 },
      { lastPeriodStart: '10/09/2026' },
      { temperatureUnit: 'K' },
      { birthYear: 1800 },
      { customTags: ['x'.repeat(41)] },
      { confirmedLongCycles: ['June'] },
    ];
    for (const extra of bad) {
      const r = await api('POST', '/api/collections/cycle_settings/records', { token: b.token, body: settings(b.id, extra) });
      assert.equal(r.status, 400, `accepted ${JSON.stringify(extra)}`);
    }
  });
});

describe('deleting an account', () => {
  it('deletes all of that user’s data', async () => {
    const c = await signUp('c@test.local');
    await api('POST', '/api/collections/entries/records', { token: c.token, body: entry(c.id, '2026-09-01') });
    await api('POST', '/api/collections/cycle_settings/records', { token: c.token, body: settings(c.id) });
    assert.equal((await api('DELETE', `/api/collections/users/records/${c.id}`, { token: c.token })).status, 204);
    const filter = encodeURIComponent(`user = "${c.id}"`);
    assert.equal((await api('GET', `/api/collections/entries/records?filter=${filter}`, { token: admin })).body.totalItems, 0);
    assert.equal((await api('GET', `/api/collections/cycle_settings/records?filter=${filter}`, { token: admin })).body.totalItems, 0);
  });
});
