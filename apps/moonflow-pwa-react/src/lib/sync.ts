// src/lib/sync.ts — T99: the sync engine (design: ADR-054).
//
// One run: refresh the session, pull what the server changed since the last
// pull (by the server's own `updated` time, never this phone's clock), merge
// it day by day (newest updatedAt wins), then push the outbox in batches of
// up to 50 (PocketHost allows 50 requests per 10 s per IP).
//
// Every run is tied to the database and the session it started with. If
// either changes — the duress PIN switched to the decoy, or someone signed
// out or in — the run stops before its next write.
import { backendBase } from './backend';
import { bumpSessionEpoch, sessionEpoch } from './sync-signal';
import { refreshSession } from './account';
import { db as activeDb, SETTINGS_DEFAULTS, SYNCED_SETTING_KEYS, type MoonflowDB } from './db';
import {
  decideEntry,
  entryFromRemote,
  entryToRemote,
  pickSynced,
  settingsFromRemote,
  settingsToRemote,
  unionTags,
  type RemoteEntry,
  type RemoteSettings,
  type SyncedSettings,
} from './sync-merge';
import type { AccountSession, Settings } from './types';

const PAGE = 500;
/** Each pull re-reads a few seconds before the cursor: a row stamped just
 * before the last pull but committed just after it would otherwise be missed.
 * Re-reading is harmless (a tie changes nothing). */
const CURSOR_OVERLAP_MS = 5000;
const BATCH = 50;

export type SyncOutcome =
  | { result: 'synced'; changed: boolean; rejected: number }
  | { result: 'signed-out' | 'offline' | 'expired' | 'aborted' };

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'offline' | 'expired';
  lastSyncedAt: number | null;
  rejected: number;
}

class Aborted extends Error {}
class Offline extends Error {}
class Expired extends Error {}

// ---- status, for Settings → Account -------------------------------------

let status: SyncStatus = { state: 'idle', lastSyncedAt: null, rejected: 0 };
const statusListeners = new Set<() => void>();

export function getSyncStatus(): SyncStatus {
  return status;
}

export function subscribeSyncStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  statusListeners.forEach((l) => l());
}

/** Load the persisted part of the status (after a relaunch). */
export async function loadSyncStatus(target: MoonflowDB = activeDb) {
  const [last, expired, rejected] = await Promise.all([
    readState<number>(target, 'lastSyncedAt'),
    readState<boolean>(target, 'expired'),
    readState<Record<string, number>>(target, 'rejectedKeys'),
  ]);
  setStatus({ lastSyncedAt: last ?? null, state: expired ? 'expired' : 'idle', rejected: Object.keys(rejected ?? {}).length });
}

// ---- sync state helpers --------------------------------------------------

async function readState<T>(target: MoonflowDB, key: string): Promise<T | undefined> {
  return (await target.syncState.get(key))?.value as T | undefined;
}

/** "2026-11-01 12:06:22.123Z" (PocketBase's format) minus `ms`. */
function earlier(stamp: string, ms: number): string {
  return new Date(new Date(stamp.replace(' ', 'T')).getTime() - ms).toISOString().replace('T', ' ');
}

async function readSettings(target: MoonflowDB): Promise<Settings> {
  const rows = await target.settings.toArray();
  const s = { ...SETTINGS_DEFAULTS };
  for (const row of rows) (s as Record<string, unknown>)[row.key] = row.value;
  return s;
}

// ---- sessions --------------------------------------------------------------

const PER_SERVER_STATE = ['cursor', 'remoteIds', 'settingsRemoteId', 'expired', 'rejectedKeys'];

/** Called when someone signs in on this database. A different account than
 * last time gets none of the old bookkeeping; any sign-in starts with a full
 * merge (ADR-054). */
export async function beginSession(session: AccountSession, target: MoonflowDB = activeDb) {
  bumpSessionEpoch();
  await target.transaction('rw', [target.syncState, target.outbox, target.tombstones], async () => {
    const last = await readState<string>(target, 'lastAccountUserId');
    if (last && last !== session.userId) {
      await target.outbox.clear();
      await target.tombstones.clear();
    }
    for (const key of PER_SERVER_STATE) await target.syncState.delete(key);
    await target.syncState.put({ key: 'lastAccountUserId', value: session.userId });
  });
  setStatus({ state: 'idle', rejected: 0 });
}

/** Called on sign-out: forget where this database stood with the server.
 * Local data, tombstones, the outbox and whose settings these were stay, so
 * signing back in to the same account loses nothing. */
export async function endSession(target: MoonflowDB = activeDb) {
  bumpSessionEpoch();
  await target.transaction('rw', target.syncState, async () => {
    for (const key of [...PER_SERVER_STATE, 'lastSyncedAt']) await target.syncState.delete(key);
  });
  setStatus({ state: 'idle', lastSyncedAt: null, rejected: 0 });
}

/** "Replace this phone's data" at sign-in: empties this database's days and
 * sync bookkeeping so the next sync brings in only the account's data. The
 * days are cleared directly — no tombstones, no outbox — so nothing is
 * deleted from any account. Settings stay; the account's win on the first
 * sync anyway (pullSettings). PIN, theme and other phone-only settings are
 * untouched. */
export async function replaceLocalData(target: MoonflowDB = activeDb) {
  bumpSessionEpoch();
  await target.transaction('rw', [target.entries, target.tombstones, target.outbox, target.syncState], async () => {
    await target.entries.clear();
    await target.tombstones.clear();
    await target.outbox.clear();
    await target.syncState.clear();
  });
}

/** What the first-sync confirmation needs ("This phone has 42 days and your
 * account has 120"). `otherAccount`: this phone's days were last synced with a
 * different account. null when the server can't be reached. */
export async function mergePreview(
  session: AccountSession,
  target: MoonflowDB = activeDb,
): Promise<{ local: number; remote: number; otherAccount: boolean } | null> {
  const res = await request(session, 'GET', `/api/collections/entries/records?perPage=1&filter=${encodeURIComponent('deleted = false')}`).catch(() => null);
  if (!res || res.status !== 200) return null;
  const last = await readState<string>(target, 'lastAccountUserId');
  return {
    local: await target.entries.count(),
    remote: (res.body as { totalItems: number }).totalItems,
    otherAccount: Boolean(last && last !== session.userId),
  };
}

// ---- transport -------------------------------------------------------------

async function request(session: AccountSession, method: string, path: string, body?: unknown): Promise<{ status: number; body: unknown }> {
  let res: Response;
  try {
    res = await fetch(`${backendBase()}${path}`, {
      method,
      headers: { 'content-type': 'application/json', authorization: session.token },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Offline();
  }
  if (res.status === 401) throw new Expired();
  if (res.status >= 500 || res.status === 429) throw new Offline();
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

// ---- the run ---------------------------------------------------------------

interface RunContext {
  target: MoonflowDB;
  session: AccountSession;
  /** Throws if the database or the session changed since the run started. */
  alive: () => void;
  pageSize: number;
}

export async function syncDatabase(
  target: MoonflowDB = activeDb,
  { isCurrent = () => activeDb === target, pageSize = PAGE }: { isCurrent?: () => boolean; pageSize?: number } = {},
): Promise<SyncOutcome> {
  const epoch = sessionEpoch();
  const alive = () => {
    if (!isCurrent() || sessionEpoch() !== epoch) throw new Aborted();
  };
  const signedIn = (await readSettings(target)).account;
  if (!signedIn) return { result: 'signed-out' };

  setStatus({ state: 'syncing' });
  try {
    const refreshed = await refreshSession(signedIn);
    if (!refreshed.ok) throw refreshed.reason === 'expired' ? new Expired() : new Offline();
    const session = refreshed.session;
    alive();
    await target.transaction('rw', target.settings, async () => {
      // Only replace the token of the session that's still signed in.
      const stored = (await target.settings.get('account'))?.value as AccountSession | null | undefined;
      if (stored?.userId !== session.userId) throw new Aborted();
      await target.settings.put({ key: 'account', value: session });
    });

    const ctx: RunContext = { target, session, alive, pageSize };
    const changed = (await pullEntries(ctx)) | (await pullSettings(ctx));
    const rejected = await push(ctx);

    alive();
    const now = Date.now();
    await target.transaction('rw', target.syncState, async () => {
      await target.syncState.put({ key: 'lastSyncedAt', value: now });
      await target.syncState.delete('expired');
    });
    setStatus({ state: 'idle', lastSyncedAt: now, rejected });
    return { result: 'synced', changed: Boolean(changed), rejected };
  } catch (err) {
    if (err instanceof Aborted) {
      setStatus({ state: 'idle' });
      return { result: 'aborted' };
    }
    if (err instanceof Expired) {
      if (isCurrent() && sessionEpoch() === epoch) await target.syncState.put({ key: 'expired', value: true });
      setStatus({ state: 'expired' });
      return { result: 'expired' };
    }
    if (!(err instanceof Offline)) console.error('sync failed:', err);
    setStatus({ state: 'offline' });
    return { result: 'offline' };
  }
}

/** Returns 1 if any local day changed, else 0. Pages by (updated, id) — not
 * page offsets, which skip a row whenever another device edits a day on an
 * earlier page mid-pull. */
async function pullEntries({ target, session, alive, pageSize }: RunContext): Promise<number> {
  const cursor = await readState<string>(target, 'cursor');
  const since = cursor ? earlier(cursor, CURSOR_OVERLAP_MS) : '';
  const remoteIds = { ...((await readState<Record<string, string>>(target, 'remoteIds')) ?? {}) };
  let newest = cursor ?? '';
  let after: RemoteEntry | undefined;
  let changed = 0;

  for (;;) {
    const parts: string[] = [];
    if (since) parts.push(`updated >= "${since}"`);
    if (after) parts.push(`(updated > "${after.updated}" || (updated = "${after.updated}" && id > "${after.id}"))`);
    const filter = parts.length ? `&filter=${encodeURIComponent(parts.join(' && '))}` : '';
    const res = await request(session, 'GET', `/api/collections/entries/records?perPage=${pageSize}&sort=updated,id&skipTotal=1${filter}`);
    if (res.status !== 200) throw new Offline();
    const items = (res.body as { items: RemoteEntry[] }).items;

    alive();
    await target.transaction('rw', [target.entries, target.tombstones, target.outbox], async () => {
      for (const r of items) {
        remoteIds[r.date] = r.id;
        if (r.updated > newest) newest = r.updated;
        const key = `entry:${r.date}`;
        const [local, tomb] = await Promise.all([target.entries.get(r.date), target.tombstones.get(r.date)]);
        const decision = decideEntry(r, local, tomb);
        if (decision === 'take-remote') {
          if (r.deleted) {
            if (local) changed = 1;
            await target.entries.delete(r.date);
          } else {
            await target.entries.put(entryFromRemote(r));
            changed = 1;
          }
          await target.tombstones.delete(r.date);
          await target.outbox.delete(key);
        } else if (decision === 'keep-local') {
          await target.outbox.put({ key });
        } else if (tomb && r.deleted) {
          await target.tombstones.delete(r.date);
          await target.outbox.delete(key);
        }
      }
    });
    after = items.at(-1);
    if (items.length < pageSize) break;
  }

  alive();
  await target.transaction('rw', [target.syncState, target.entries, target.tombstones, target.outbox], async () => {
    if (!cursor) {
      // First (full) pull: anything only this phone has must go up, and a
      // tombstone the server never had a row for has nothing to delete.
      for (const date of await target.entries.toCollection().primaryKeys()) {
        if (!remoteIds[date]) await target.outbox.put({ key: `entry:${date}` });
      }
      for (const t of await target.tombstones.toArray()) {
        if (!remoteIds[t.date]) {
          await target.tombstones.delete(t.date);
          await target.outbox.delete(`entry:${t.date}`);
        }
      }
    }
    await target.syncState.put({ key: 'remoteIds', value: remoteIds });
    if (newest) await target.syncState.put({ key: 'cursor', value: newest });
  });
  return changed;
}

/** Whole settings row, newest wins; custom tags union. The first time this
 * database syncs settings with an account, the account's settings win, so a
 * freshly set-up phone doesn't overwrite real settings with its onboarding
 * defaults. Signing back in to the same account is not a first time. Returns
 * 1 if local settings changed. */
async function pullSettings({ target, session, alive }: RunContext): Promise<number> {
  const res = await request(session, 'GET', '/api/collections/cycle_settings/records?perPage=1');
  if (res.status !== 200) throw new Offline();
  const row = (res.body as { items: RemoteSettings[] }).items[0];

  alive();
  return target.transaction('rw', [target.settings, target.syncState, target.outbox], async () => {
    if (!row) {
      await target.syncState.put({ key: 'settingsRemoteId', value: '' });
      await target.outbox.put({ key: 'settings' });
      return 0;
    }
    // Read inside the transaction: an edit made while the pull was in flight
    // must be merged, not overwritten with a stale copy.
    const local = pickSynced(await readSettings(target));
    const localChangedAt = (await readState<number>(target, 'settingsChangedAt')) ?? 0;
    const firstSync = (await readState<string>(target, 'settingsSyncedFor')) !== session.userId;
    await target.syncState.put({ key: 'settingsRemoteId', value: row.id });
    await target.syncState.put({ key: 'settingsSyncedFor', value: session.userId });

    const remote = settingsFromRemote(row);
    const tags = unionTags(local.customTags, remote.customTags);
    const tagsAdded = tags.length !== remote.customTags.length;
    let next: SyncedSettings;
    if (firstSync || row.updatedAt > localChangedAt) {
      next = { ...remote, customTags: tags };
      if (tagsAdded) {
        await target.syncState.put({ key: 'settingsChangedAt', value: Math.max(Date.now(), row.updatedAt + 1) });
        await target.outbox.put({ key: 'settings' });
      } else {
        await target.syncState.put({ key: 'settingsChangedAt', value: row.updatedAt });
        await target.outbox.delete('settings');
      }
    } else if (row.updatedAt < localChangedAt) {
      // This phone's edit is newer: keep it (and its stamp) and send it.
      next = { ...local, customTags: tags };
      await target.outbox.put({ key: 'settings' });
    } else {
      // Same stamp: already in step. Nothing to send unless the tag union
      // found something new.
      next = { ...local, customTags: tags };
      if (tagsAdded) {
        await target.syncState.put({ key: 'settingsChangedAt', value: Math.max(Date.now(), row.updatedAt + 1) });
        await target.outbox.put({ key: 'settings' });
      }
    }
    const differs = SYNCED_SETTING_KEYS.some((k) => JSON.stringify(next[k]) !== JSON.stringify(local[k]));
    if (differs) {
      await target.settings.bulkPut(SYNCED_SETTING_KEYS.map((k) => ({ key: k, value: next[k] })) as never);
    }
    return differs ? 1 : 0;
  });
}

interface PlannedRequest {
  key: string;
  date: string;
  method: 'POST' | 'PATCH';
  url: string;
  body: Record<string, unknown>;
  /** The local stamp this request carries; the outbox entry is cleared only
   * if nothing changed the day again while the request was in flight. */
  stamp: number;
  tombstone: boolean;
}

/** A deleted day's content is wiped on the server too, not just flagged. */
const BLANK_DAY = { flow: '', symptoms: [], mood: '', note: '', tags: [], temperature: 0, tempDisturbed: false, mucus: '' };

/** Sends the outbox. Returns how many rows the server has rejected. A
 * rejected row isn't retried until it changes again, so one bad row can't
 * make every sync heavier. */
async function push({ target, session, alive }: RunContext): Promise<number> {
  const keys = (await target.outbox.toCollection().primaryKeys()) as string[];
  const remoteIds = { ...((await readState<Record<string, string>>(target, 'remoteIds')) ?? {}) };
  const rejectedKeys = { ...((await readState<Record<string, number>>(target, 'rejectedKeys')) ?? {}) };
  const plans: PlannedRequest[] = [];
  const drop: Array<{ key: string; date: string; tombStamp: number | undefined }> = [];

  for (const key of keys) {
    if (key === 'settings') continue;
    const date = key.slice('entry:'.length);
    const [local, tomb] = await Promise.all([target.entries.get(date), target.tombstones.get(date)]);
    const id = remoteIds[date];
    const stamp = local?.updatedAt ?? tomb?.deletedAt;
    if (stamp !== undefined && rejectedKeys[key] === stamp) continue;
    if (local) {
      const body = entryToRemote(local);
      plans.push(id
        ? { key, date, method: 'PATCH', url: `/api/collections/entries/records/${id}`, body, stamp: local.updatedAt, tombstone: false }
        : { key, date, method: 'POST', url: '/api/collections/entries/records', body: { ...body, user: session.userId }, stamp: local.updatedAt, tombstone: false });
    } else if (tomb && id) {
      plans.push({ key, date, method: 'PATCH', url: `/api/collections/entries/records/${id}`, body: { ...BLANK_DAY, deleted: true, updatedAt: tomb.deletedAt }, stamp: tomb.deletedAt, tombstone: true });
    } else {
      drop.push({ key, date, tombStamp: tomb?.deletedAt }); // nothing on the server to change
    }
  }

  const done: Array<{ plan: PlannedRequest; id?: string }> = [];
  const failed: PlannedRequest[] = [];
  // A batch is all-or-nothing, so one bad row fails the lot. Split a failing
  // batch in halves until the bad rows are isolated: about a dozen requests
  // for one bad row in 50, instead of 50.
  async function send(chunk: PlannedRequest[]) {
    const res = await request(session, 'POST', '/api/batch', {
      requests: chunk.map((p) => ({ method: p.method, url: p.url, body: p.body })),
    });
    if (res.status === 200) {
      (res.body as Array<{ body: { id?: string } }>).forEach((r, j) => done.push({ plan: chunk[j]!, id: r.body?.id }));
    } else if (chunk.length === 1) {
      failed.push(chunk[0]!);
    } else {
      const half = Math.ceil(chunk.length / 2);
      await send(chunk.slice(0, half));
      await send(chunk.slice(half));
    }
  }
  for (let i = 0; i < plans.length; i += BATCH) await send(plans.slice(i, i + BATCH));

  alive();
  await target.transaction('rw', [target.entries, target.tombstones, target.outbox, target.syncState], async () => {
    for (const { key, date, tombStamp } of drop) {
      // Re-check: the day may have been logged again while requests were out.
      if (await target.entries.get(date)) continue;
      if ((await target.tombstones.get(date))?.deletedAt !== tombStamp) continue;
      await target.outbox.delete(key);
      await target.tombstones.delete(date);
    }
    for (const { plan, id } of done) {
      if (id) remoteIds[plan.date] = id;
      delete rejectedKeys[plan.key];
      const current = plan.tombstone ? (await target.tombstones.get(plan.date))?.deletedAt : (await target.entries.get(plan.date))?.updatedAt;
      if (current === plan.stamp) {
        await target.outbox.delete(plan.key);
        if (plan.tombstone) await target.tombstones.delete(plan.date);
      }
    }
    for (const plan of failed) rejectedKeys[plan.key] = plan.stamp;
    // Forget rejections for days that have since synced or left the outbox.
    const pending = new Set((await target.outbox.toCollection().primaryKeys()) as string[]);
    for (const key of Object.keys(rejectedKeys)) if (!pending.has(key)) delete rejectedKeys[key];
    await target.syncState.put({ key: 'remoteIds', value: remoteIds });
    await target.syncState.put({ key: 'rejectedKeys', value: rejectedKeys });
  });

  const settingsRejected = keys.includes('settings') ? await pushSettings({ target, session, alive, pageSize: PAGE }) : 0;
  return Object.keys(rejectedKeys).length + settingsRejected;
}

async function pushSettings({ target, session, alive }: RunContext): Promise<number> {
  alive();
  // One transaction, so the values and the stamp sent always belong together.
  const { s, changedAt, id } = await target.transaction('rw', [target.settings, target.syncState], async () => {
    let stamp = await readState<number>(target, 'settingsChangedAt');
    if (stamp === undefined) {
      // Never changed on this phone (defaults): stamp it so the outbox entry
      // can be matched and cleared below.
      stamp = Date.now();
      await target.syncState.put({ key: 'settingsChangedAt', value: stamp });
    }
    return { s: pickSynced(await readSettings(target)), changedAt: stamp, id: await readState<string>(target, 'settingsRemoteId') };
  });
  const body = settingsToRemote(s, changedAt);
  const res = id
    ? await request(session, 'PATCH', `/api/collections/cycle_settings/records/${id}`, body)
    : await request(session, 'POST', '/api/collections/cycle_settings/records', { ...body, user: session.userId });
  if (res.status !== 200) return 1;
  alive();
  await target.transaction('rw', [target.syncState, target.outbox], async () => {
    await target.syncState.put({ key: 'settingsRemoteId', value: (res.body as { id: string }).id });
    await target.syncState.put({ key: 'settingsSyncedFor', value: session.userId });
    if ((await readState<number>(target, 'settingsChangedAt')) === changedAt) await target.outbox.delete('settings');
  });
  return 0;
}
