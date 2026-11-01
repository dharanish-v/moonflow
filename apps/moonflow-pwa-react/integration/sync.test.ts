// T99 (ADR-054) — two simulated devices syncing through a real PocketBase
// (the backend's pinned binary, migrations and hooks). Needs
// apps/moonflow-backend/scripts/fetch-pocketbase.sh to have run.
import 'fake-indexeddb/auto';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { signUp } from '../src/lib/account';
import { setBackendBaseForTests } from '../src/lib/backend';
import { MoonflowDB } from '../src/lib/db';
import { beginSession, endSession, getSyncStatus, mergePreview, replaceLocalData, syncDatabase } from '../src/lib/sync';
import type { AccountSession, Entry } from '../src/lib/types';

const backend = resolve(import.meta.dirname, '../../moonflow-backend');
const bin = join(backend, '.bin/pocketbase');
const port = 19000 + Math.floor(Math.random() * 1000);
const base = `http://127.0.0.1:${port}`;
const dir = mkdtempSync(join(tmpdir(), 'moonflow-sync-'));
let server: ChildProcess | undefined;

beforeAll(async () => {
  if (!existsSync(bin)) throw new Error(`Run ${backend}/scripts/fetch-pocketbase.sh first`);
  const args = ['--dir', dir, '--migrationsDir', join(backend, 'pb_migrations'), '--hooksDir', join(backend, 'pb_hooks')];
  execFileSync(bin, ['migrate', 'up', ...args], { stdio: 'ignore' });
  server = spawn(bin, ['serve', '--http', `127.0.0.1:${port}`, ...args], { stdio: 'ignore' });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  setBackendBaseForTests(base);
}, 30_000);

afterAll(() => {
  server?.kill();
  rmSync(dir, { recursive: true, force: true });
});

let n = 0;
async function newAccount(): Promise<AccountSession> {
  const r = await signUp(`user${++n}-${Date.now()}@test.local`, 'long enough password');
  if (!r.ok) throw new Error(r.error);
  return r.session;
}

/** A device: its own database, signed in to `session`. */
async function device(session: AccountSession) {
  const d = new MoonflowDB(`device-${++n}-${Math.random()}`);
  await d.settings.bulkPut([
    { key: 'onboardingComplete', value: true },
    { key: 'account', value: session },
  ]);
  await beginSession(session, d);
  return d;
}

const sync = (d: MoonflowDB, isCurrent = () => true, pageSize?: number) => syncDatabase(d, { isCurrent, pageSize });

// The same bookkeeping db.ts does on every real write.
async function save(d: MoonflowDB, date: string, extra: Partial<Entry> = {}, updatedAt = Date.now()) {
  await d.entries.put({ date, flow: 'medium', symptoms: [], mood: null, note: '', tags: [], updatedAt, ...extra });
  await d.outbox.put({ key: `entry:${date}` });
  await d.tombstones.delete(date);
}
async function remove(d: MoonflowDB, date: string, at = Date.now()) {
  await d.entries.delete(date);
  await d.tombstones.put({ date, deletedAt: at });
  await d.outbox.put({ key: `entry:${date}` });
}
async function setSynced(d: MoonflowDB, patch: Record<string, unknown>, at = Date.now()) {
  await d.settings.bulkPut(Object.entries(patch).map(([key, value]) => ({ key, value })) as never);
  await d.syncState.put({ key: 'settingsChangedAt', value: at });
  await d.outbox.put({ key: 'settings' });
}
const dates = async (d: MoonflowDB) => (await d.entries.orderBy('date').toArray()).map((e) => e.date);
const setting = async (d: MoonflowDB, key: string) => (await d.settings.get(key))?.value;

describe('sync between two devices (ADR-054)', () => {
  it('brings one device’s days to the other', async () => {
    const s = await newAccount();
    const a = await device(s);
    await save(a, '2026-09-01');
    await save(a, '2026-09-02', { note: 'from A' });
    expect((await sync(a)).result).toBe('synced');
    const b = await device(s);
    expect(await sync(b)).toMatchObject({ result: 'synced', changed: true });
    expect(await dates(b)).toEqual(['2026-09-01', '2026-09-02']);
    expect((await b.entries.get('2026-09-02'))!.note).toBe('from A');
    expect(await a.outbox.count()).toBe(0);
  });

  it('keeps the newest version when both devices edited the same day offline', async () => {
    const s = await newAccount();
    const a = await device(s);
    const b = await device(s);
    await save(a, '2026-09-05', { note: 'older, from A' }, 1000);
    await save(b, '2026-09-05', { note: 'newer, from B' }, 2000);
    await sync(a);
    await sync(b);
    await sync(a);
    expect((await a.entries.get('2026-09-05'))!.note).toBe('newer, from B');
    expect((await b.entries.get('2026-09-05'))!.note).toBe('newer, from B');
  });

  it('syncs a deletion, and drops the tombstone once the server has it', async () => {
    const s = await newAccount();
    const a = await device(s);
    const b = await device(s);
    await save(a, '2026-09-10');
    await sync(a);
    await sync(b);
    expect(await dates(b)).toEqual(['2026-09-10']);
    await remove(b, '2026-09-10');
    await sync(b);
    expect(await b.tombstones.count()).toBe(0);
    await sync(a);
    expect(await dates(a)).toEqual([]);
  });

  it('does not bring a deleted day back from the server', async () => {
    const s = await newAccount();
    const a = await device(s);
    await save(a, '2026-09-11', {}, 1000);
    await sync(a);
    await remove(a, '2026-09-11', 2000);
    await sync(a);
    await sync(a);
    expect(await dates(a)).toEqual([]);
  });

  it('syncs settings, newest wins, and merges custom tags from both sides', async () => {
    const s = await newAccount();
    const a = await device(s);
    const b = await device(s);
    await setSynced(a, { avgCycleLength: 31, customTags: ['Pill'] }, 1000);
    await sync(a);
    await sync(b);
    expect(await setting(b, 'avgCycleLength')).toBe(31);
    await setSynced(b, { customTags: ['Pill', 'Ibuprofen'] }, 2000);
    await setSynced(a, { customTags: ['Pill', 'Magnesium'] }, 1500);
    await sync(b);
    await sync(a);
    await sync(b);
    for (const d of [a, b]) expect(new Set(await setting(d, 'customTags') as string[])).toEqual(new Set(['Pill', 'Ibuprofen', 'Magnesium']));
  });

  it('on a device’s first sync, the account’s settings beat fresh onboarding defaults', async () => {
    const s = await newAccount();
    const a = await device(s);
    await setSynced(a, { avgCycleLength: 33, perimenopauseMode: true }, 1000);
    await sync(a);
    const b = await device(s);
    await setSynced(b, { avgCycleLength: 28 }, Date.now()); // onboarding, just now
    await sync(b);
    expect(await setting(b, 'avgCycleLength')).toBe(33);
    expect(await setting(b, 'perimenopauseMode')).toBe(true);
  });

  it('uploads 400 days in batches, well under 50 requests', async () => {
    const s = await newAccount();
    const a = await device(s);
    for (let i = 0; i < 400; i++) await save(a, new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10), {}, 1000 + i);
    const spy = vi.spyOn(globalThis, 'fetch');
    expect((await sync(a)).result).toBe('synced');
    const calls = spy.mock.calls.length;
    spy.mockRestore();
    expect(calls).toBeLessThan(15);
    expect(await a.outbox.count()).toBe(0);
    const b = await device(s);
    await sync(b);
    expect(await b.entries.count()).toBe(400);
  }, 60_000);

  it('stops without writing anything when the database is switched mid-sync (duress PIN)', async () => {
    const s = await newAccount();
    const a = await device(s);
    await save(a, '2026-09-20');
    await sync(a);
    const b = await device(s);
    let current = true;
    const realFetch = globalThis.fetch;
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (...args) => {
      if (String(args[0]).includes('/api/collections/entries/records')) current = false; // switched during the pull
      return realFetch(...args);
    });
    const result = await sync(b, () => current);
    spy.mockRestore();
    expect(result.result).toBe('aborted');
    expect(await b.entries.count()).toBe(0);
    expect(await b.syncState.get('cursor')).toBeUndefined();
  });

  it('keeps everything and asks to sign in again when the session has expired', async () => {
    const s = await newAccount();
    const a = await device({ ...s, token: 'not-a-real-token' });
    await save(a, '2026-09-21');
    expect((await sync(a)).result).toBe('expired');
    expect(getSyncStatus().state).toBe('expired');
    expect(await a.entries.count()).toBe(1);
    expect(await a.outbox.count()).toBe(1);
  });

  it('skips and counts a day the server rejects, and still sends the rest', async () => {
    const s = await newAccount();
    const a = await device(s);
    await save(a, '2026-09-22');
    await save(a, '2026-09-23', { flow: 'gushing' as never });
    const r = await sync(a);
    expect(r).toMatchObject({ result: 'synced', rejected: 1 });
    expect((await a.outbox.toArray()).map((o) => o.key)).toEqual(['entry:2026-09-23']);
    const b = await device(s);
    await sync(b);
    expect(await dates(b)).toEqual(['2026-09-22']);
  });

  it('forgets another account’s pending deletions when a different account signs in', async () => {
    const first = await newAccount();
    const a = await device(first);
    await remove(a, '2026-09-24');
    const second = await newAccount();
    await a.settings.put({ key: 'account', value: second });
    await beginSession(second, a);
    expect(await a.tombstones.count()).toBe(0);
  });
});

// Regressions for the T99 code review — each reproduces a reported scenario.
describe('sync review regressions', () => {
  async function serverRow(session: AccountSession, collection: string, filter: string) {
    const res = await fetch(`${base}/api/collections/${collection}/records?filter=${encodeURIComponent(filter)}`, { headers: { authorization: session.token } });
    return ((await res.json()) as { items: Array<Record<string, unknown>> }).items[0];
  }

  it('settings in step are not re-sent, and an older device can\u2019t overwrite a newer offline edit', async () => {
    const s = await newAccount();
    const a = await device(s);
    const b = await device(s);
    await setSynced(b, { avgCycleLength: 30 }, 10_000);
    await sync(b);
    await sync(a);
    expect(await setting(a, 'avgCycleLength')).toBe(30);
    const before = await serverRow(s, 'cycle_settings', 'id != ""');
    await sync(a); // a tie: nothing to send
    expect(await a.outbox.get('settings')).toBeUndefined();
    expect((await serverRow(s, 'cycle_settings', 'id != ""'))!.updatedAt).toBe(before!.updatedAt);
    await setSynced(b, { avgCycleLength: 35 }, 20_000); // B, offline
    await sync(a);
    await sync(b);
    await sync(a);
    expect(await setting(a, 'avgCycleLength')).toBe(35);
    expect(await setting(b, 'avgCycleLength')).toBe(35);
  });

  it('a day logged again while a sync is pushing stays queued', async () => {
    const s = await newAccount();
    const a = await device(s);
    await save(a, '2026-10-01');
    await sync(a);
    await sync(a); // the pull now returns a row, so the cursor is set
    expect(await a.syncState.get('cursor')).toBeDefined();
    await save(a, '2026-10-02');
    await remove(a, '2026-10-02'); // tombstone with no server row: nothing to send
    await save(a, '2026-10-03'); // gives the run a network round trip
    const realFetch = globalThis.fetch;
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (...args) => {
      const res = await realFetch(...args);
      if (String(args[0]).endsWith('/api/batch')) await save(a, '2026-10-02', { note: 'logged again' });
      return res;
    });
    await sync(a);
    spy.mockRestore();
    expect(await a.outbox.get('entry:2026-10-02')).toBeDefined();
    await sync(a);
    const b = await device(s);
    await sync(b);
    expect((await b.entries.get('2026-10-02'))?.note).toBe('logged again');
  });

  it('signing back in to the same account keeps a settings edit made while signed out', async () => {
    const s = await newAccount();
    const a = await device(s);
    await setSynced(a, { avgCycleLength: 29 }, 1000);
    await sync(a);
    await endSession(a);
    await setSynced(a, { avgCycleLength: 40 });
    await beginSession(s, a);
    await sync(a);
    expect(await setting(a, 'avgCycleLength')).toBe(40);
    expect((await serverRow(s, 'cycle_settings', 'id != ""'))!.avgCycleLength).toBe(40);
  });

  it('signing out mid-sync is not undone by the sync', async () => {
    const s = await newAccount();
    const a = await device(s);
    const realFetch = globalThis.fetch;
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (...args) => {
      const res = await realFetch(...args);
      if (String(args[0]).includes('/auth-refresh')) {
        await endSession(a);
        await a.settings.put({ key: 'account', value: null });
      }
      return res;
    });
    const r = await sync(a);
    spy.mockRestore();
    expect(r.result).toBe('aborted');
    expect(await setting(a, 'account')).toBeNull();
    expect(await a.syncState.get('cursor')).toBeUndefined();
  });

  it('pulls every day even when another device edits one mid-pull', async () => {
    const s = await newAccount();
    const a = await device(s);
    for (let i = 1; i <= 20; i++) await save(a, `2026-08-${String(i).padStart(2, '0')}`, {}, 1000 + i);
    await sync(a);
    const b = await device(s);
    const realFetch = globalThis.fetch;
    let edited = false;
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (...args) => {
      const res = await realFetch(...args);
      if (!edited && String(args[0]).includes('/entries/records?perPage=7')) {
        edited = true;
        spy.mockRestore();
        await save(a, '2026-08-01', { note: 'edited mid-pull' }); // moves to the end of the sort
        await sync(a);
      }
      return res;
    });
    await sync(b, () => true, 7);
    spy.mockRestore();
    expect(await b.entries.count()).toBe(20);
  });

  it('wipes a deleted day\u2019s content on the server, not just flags it', async () => {
    const s = await newAccount();
    const a = await device(s);
    await save(a, '2026-10-05', { note: 'very private', mood: 'sad', symptoms: ['cramps'], tags: ['x'] });
    await sync(a);
    await remove(a, '2026-10-05');
    await sync(a);
    const row = await serverRow(s, 'entries', 'date = "2026-10-05"');
    expect(row).toMatchObject({ deleted: true, note: '', mood: '', symptoms: [], tags: [], flow: '' });
  });

  it('does not keep re-sending a rejected day until it changes', async () => {
    const s = await newAccount();
    const a = await device(s);
    await save(a, '2026-10-06', { flow: 'gushing' as never });
    expect(await sync(a)).toMatchObject({ rejected: 1 });
    const spy = vi.spyOn(globalThis, 'fetch');
    expect(await sync(a)).toMatchObject({ rejected: 1 });
    const batches = spy.mock.calls.filter((c) => String(c[0]).endsWith('/api/batch')).length;
    spy.mockRestore();
    expect(batches).toBe(0);
    await save(a, '2026-10-06', { flow: 'light' });
    expect(await sync(a)).toMatchObject({ rejected: 0 });
  });

  it('tells the sign-in screen when this phone\u2019s days belong to another account', async () => {
    const first = await newAccount();
    const a = await device(first);
    await save(a, '2026-10-07');
    await sync(a);
    const second = await newAccount();
    expect(await mergePreview(second, a)).toEqual({ local: 1, remote: 0, otherAccount: true });
    expect(await mergePreview(first, a)).toMatchObject({ otherAccount: false });
  });

  it('"Replace this phone\u2019s data" loads only the account\u2019s days and deletes nothing from the account', async () => {
    const s = await newAccount();
    const owner = await device(s);
    await save(owner, '2026-07-01', { note: 'in the account' });
    await save(owner, '2026-07-02', { note: 'also in the account' });
    await sync(owner);
    await sync(owner);

    // A phone with its own days, never signed in, one of them the same date.
    const phone = new MoonflowDB(`phone-${Math.random()}`);
    await phone.settings.put({ key: 'onboardingComplete', value: true });
    await phone.settings.put({ key: 'pinLockEnabled', value: true });
    await save(phone, '2026-07-01', { note: 'phone only, newer' }, Date.now() + 60_000);
    await save(phone, '2026-07-05', { note: 'phone only' });

    await replaceLocalData(phone);
    await phone.settings.put({ key: 'account', value: s });
    await beginSession(s, phone);
    expect((await sync(phone)).result).toBe('synced');

    expect(await dates(phone)).toEqual(['2026-07-01', '2026-07-02']);
    expect((await phone.entries.get('2026-07-01'))!.note).toBe('in the account');
    expect(await setting(phone, 'pinLockEnabled')).toBe(true); // phone-only settings stay
    const server = await fetch(`${base}/api/collections/entries/records?sort=date`, { headers: { authorization: s.token } });
    const rows = ((await server.json()) as { items: Array<{ date: string; deleted: boolean; note: string }> }).items;
    expect(rows.map((r) => [r.date, r.deleted, r.note])).toEqual([
      ['2026-07-01', false, 'in the account'],
      ['2026-07-02', false, 'also in the account'],
    ]);
  });
});

