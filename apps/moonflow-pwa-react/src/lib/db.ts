// src/lib/db.ts — Dexie schema, typed. Ported verbatim from db.js — same DB
// name (MoonflowDB), same entries/settings schema, so existing on-device data
// carries over on same-origin deploy with zero migration script.

import Dexie, { type Table } from 'dexie';
import type { Entry, LogEntryInput, Settings, SettingKey } from './types';
import { defaultTemperatureUnit } from './temperature';
import { bumpSessionEpoch, notifyLocalChange } from './sync-signal';
import { unsubscribeThisDevice } from './push-device';

interface SettingRow<K extends SettingKey = SettingKey> {
  key: K;
  value: Settings[K];
}

/** A day deleted on this phone, kept so the deletion syncs (ADR-054). */
export interface Tombstone {
  date: string;
  deletedAt: number;
}

/** Something sync still has to send: `entry:YYYY-MM-DD` or `settings`. */
export interface OutboxRow {
  key: string;
}

/** Sync bookkeeping (cursor, remote ids, status…), one row per key. */
export interface SyncStateRow {
  key: string;
  value: unknown;
}

/** The settings that describe the person and sync (ADR-054). Everything else
 * — PIN, lockout, theme, draft, onboarding, backups, the session — stays on
 * this phone. */
export const SYNCED_SETTING_KEYS = [
  'lastPeriodStart',
  'avgCycleLength',
  'avgPeriodLength',
  'predictionsPaused',
  'customTags',
  'birthYear',
  'perimenopauseMode',
  'fertilityAwareness',
  'temperatureUnit',
  'confirmedLongCycles',
] as const satisfies readonly SettingKey[];

export class MoonflowDB extends Dexie {
  entries!: Table<Entry, string>;
  settings!: Table<SettingRow, string>;
  tombstones!: Table<Tombstone, string>;
  outbox!: Table<OutboxRow, string>;
  syncState!: Table<SyncStateRow, string>;

  constructor(name = 'MoonflowDB') {
    super(name);
    this.version(1).stores({
      entries: 'date', // primary key = "YYYY-MM-DD" — one row per day, upsert by date (never append)
      settings: 'key',
    });
    // Future fields (BBT, ovulation-test results, etc.) get added via
    // this.version(2).stores({...}) per Dexie's migration model — never by
    // mutating version 1 in place.
    // v2 (T99): sync bookkeeping. Existing data is untouched.
    this.version(2).stores({
      tombstones: 'date',
      outbox: 'key',
      syncState: 'key',
    });
  }
}

// Sync bookkeeping, called inside the same transaction as the write itself so
// a change can never land without being queued (or the other way round).
async function touchEntry(target: MoonflowDB, date: string) {
  await target.outbox.put({ key: `entry:${date}` });
  await target.tombstones.delete(date);
}

async function buryEntry(target: MoonflowDB, date: string, now: number) {
  await target.tombstones.put({ date, deletedAt: now });
  await target.outbox.put({ key: `entry:${date}` });
}

async function touchSettings(target: MoonflowDB, patch: Partial<Settings>, now: number) {
  if (!SYNCED_SETTING_KEYS.some((k) => k in patch)) return;
  await target.syncState.put({ key: 'settingsChangedAt', value: now });
  await target.outbox.put({ key: 'settings' });
}

const ENTRY_WRITE = () => [db.entries, db.outbox, db.tombstones] as const;

export type DatabaseKind = 'real' | 'decoy';

/** The real database, and a separate decoy one opened by the duress PIN
 * (T48). Same schema; every read/write below goes through `db`, so while
 * the decoy is active nothing can touch the real data. `db` is a live
 * binding — importers always see the active one. */
const databases: Record<DatabaseKind, MoonflowDB> = {
  real: new MoonflowDB('MoonflowDB'),
  decoy: new MoonflowDB('PlannerData'),
};
let active: DatabaseKind = 'real';
export let db: MoonflowDB = databases.real;

export function activeDatabase(): DatabaseKind {
  return active;
}

export async function switchDatabase(kind: DatabaseKind): Promise<void> {
  active = kind;
  db = databases[kind];
  if (kind === 'decoy') {
    // First use: make the decoy look like a set-up app, not a fresh install.
    const set = await db.settings.get('onboardingComplete');
    if (!set) {
      await db.settings.bulkPut([
        { key: 'onboardingComplete', value: true },
        { key: 'lastPeriodStart', value: null },
      ]);
    }
  }
}

// Two installed icons (Moonflow + Planner, ADR-011) can have this database
// open at once. When a newer build upgrades the schema in one of them, the
// other must let go — otherwise the upgrade blocks, or this copy keeps
// running against a closed connection and every write fails. Close, then
// tell the app (main.tsx reloads onto the new build).
const replacedListeners = new Set<() => void>();
for (const instance of Object.values(databases)) {
  instance.on('versionchange', () => {
    instance.close();
    for (const fn of replacedListeners) fn();
    return false; // we've handled it; skip Dexie's default
  });
}

export function onDatabaseReplaced(fn: () => void): () => void {
  replacedListeners.add(fn);
  return () => replacedListeners.delete(fn);
}

export const SETTINGS_DEFAULTS: Settings = {
  onboardingComplete: false,
  lastPeriodStart: null,
  avgCycleLength: 28,
  avgPeriodLength: 5,
  pinHash: null,
  duressPinHash: null,
  pinLockEnabled: false,
  pinFailedAttempts: 0,
  pinLockoutUntil: null,
  draftEntry: null,
  themeMode: 'system',
  lastBackupAt: null,
  account: null,
  pushReminders: null,
  detailedReminderText: false,
  predictionsPaused: false,
  customTags: [],
  confirmedLongCycles: [],
  fertilityAwareness: false,
  birthYear: null,
  perimenopauseMode: false,
  temperatureUnit: defaultTemperatureUnit(typeof navigator === 'undefined' ? 'en' : navigator.language),
};

/** Read one setting, falling back to its documented default if never set. */
export async function getSetting<K extends SettingKey>(key: K): Promise<Settings[K]> {
  try {
    const row = await db.settings.get(key);
    return row ? (row.value as Settings[K]) : SETTINGS_DEFAULTS[key];
  } catch (err) {
    console.error(`getSetting(${key}) failed:`, err);
    return SETTINGS_DEFAULTS[key];
  }
}

export async function setSetting<K extends SettingKey>(key: K, value: Settings[K]): Promise<boolean> {
  try {
    await db.transaction('rw', db.settings, db.syncState, db.outbox, async () => {
      await db.settings.put({ key, value });
      await touchSettings(db, { [key]: value }, Date.now());
    });
    notifyLocalChange();
    return true;
  } catch (err) {
    console.error(`setSetting(${key}) failed:`, err);
    return false; // caller shows the plain inline "Couldn't save — try again" error (see edge-case rules)
  }
}

/** Write several settings in one transaction — all of them land, or none
 * do. Multi-key updates (onboarding, PIN setup) must never half-apply: a
 * committed onboardingComplete with a failed lastPeriodStart used to leave
 * the app in a state it couldn't render. */
export async function saveSettings(patch: Partial<Settings>): Promise<boolean> {
  try {
    const rows = Object.entries(patch).map(([key, value]) => ({ key, value }) as SettingRow);
    await db.transaction('rw', db.settings, db.syncState, db.outbox, async () => {
      await db.settings.bulkPut(rows);
      await touchSettings(db, patch, Date.now());
    });
    notifyLocalChange();
    return true;
  } catch (err) {
    console.error('saveSettings failed:', err);
    return false;
  }
}

/** Load every setting at once, merged over the defaults — used at boot.
 * Throws on a read failure: silently returning defaults would make a real
 * user's device look like a first run (onboarding, PIN lock off). */
export async function loadAllSettings(): Promise<Settings> {
  const rows = await db.settings.toArray();
  const settings = { ...SETTINGS_DEFAULTS };
  for (const row of rows) {
    (settings as Record<string, unknown>)[row.key] = row.value;
  }
  return settings;
}

/** Save (upsert) a day's log entry by date — never appends, per the data-safety rules. */
export async function saveEntry(entry: LogEntryInput): Promise<boolean> {
  try {
    await db.transaction('rw', ENTRY_WRITE(), async () => {
      await db.entries.put({ ...entry, updatedAt: Date.now() });
      await touchEntry(db, entry.date);
    });
    notifyLocalChange();
    return true;
  } catch (err) {
    console.error('saveEntry failed:', err);
    return false;
  }
}

/** Load every logged entry, sorted by date ascending. Throws on a read
 * failure — an empty list would be indistinguishable from "no history". */
export async function loadAllEntries(): Promise<Entry[]> {
  return db.entries.orderBy('date').toArray();
}

/** Saves a day's log and clears the autosaved draft in one transaction.
 * Returns the stored row (with updatedAt) so callers can update state
 * directly instead of re-reading every entry. */
export async function saveEntryAndClearDraft(entry: LogEntryInput): Promise<Entry | null> {
  try {
    const stored: Entry = { ...entry, updatedAt: Date.now() };
    await db.transaction('rw', [...ENTRY_WRITE(), db.settings], async () => {
      await db.entries.put(stored);
      await touchEntry(db, stored.date);
      await db.settings.put({ key: 'draftEntry', value: null });
    });
    notifyLocalChange();
    return stored;
  } catch (err) {
    console.error('saveEntryAndClearDraft failed:', err);
    return null;
  }
}

export async function deleteEntryAndClearDraft(date: string): Promise<boolean> {
  try {
    await db.transaction('rw', [...ENTRY_WRITE(), db.settings], async () => {
      await db.entries.delete(date);
      await buryEntry(db, date, Date.now());
      await db.settings.put({ key: 'draftEntry', value: null });
    });
    notifyLocalChange();
    return true;
  } catch (err) {
    console.error('deleteEntryAndClearDraft failed:', err);
    return false;
  }
}

export async function deleteEntry(date: string): Promise<boolean> {
  try {
    await db.transaction('rw', ENTRY_WRITE(), async () => {
      await db.entries.delete(date);
      await buryEntry(db, date, Date.now());
    });
    notifyLocalChange();
    return true;
  } catch (err) {
    console.error('deleteEntry failed:', err);
    return false;
  }
}

/** Mark a run of days as a period in one transaction (T81). Days already
 * logged keep everything but get a period flow (unless they already have
 * one); new days get 'medium'. Returns what was there before, for Undo. */
export async function markPeriodDays(
  dates: string[],
): Promise<{ saved: Entry[]; previous: Array<Entry | undefined> } | null> {
  try {
    const result = await db.transaction('rw', ENTRY_WRITE(), async () => {
      const previous = await Promise.all(dates.map((d) => db.entries.get(d)));
      const saved: Entry[] = dates.map((date, i) => {
        const prev = previous[i];
        const hasPeriodFlow = prev?.flow === 'light' || prev?.flow === 'medium' || prev?.flow === 'heavy';
        return {
          ...(prev ?? { date, symptoms: [], mood: null, note: '', tags: [] }),
          date,
          flow: hasPeriodFlow ? prev!.flow : 'medium',
          updatedAt: Date.now(),
        };
      });
      await db.entries.bulkPut(saved);
      for (const date of dates) await touchEntry(db, date);
      return { saved, previous };
    });
    notifyLocalChange();
    return result;
  } catch (err) {
    console.error('markPeriodDays failed:', err);
    return null;
  }
}

/** Undo for markPeriodDays: put back what was there, remove what wasn't.
 * The restored rows get a fresh updatedAt — undoing is a new change, and with
 * the old stamp the server's newer copy would win the next sync (ADR-054). */
export async function restoreDays(dates: string[], previous: Array<Entry | undefined>): Promise<boolean> {
  try {
    const now = Date.now();
    await db.transaction('rw', ENTRY_WRITE(), async () => {
      for (let i = 0; i < dates.length; i++) {
        const prev = previous[i];
        if (prev) {
          await db.entries.put({ ...prev, updatedAt: now });
          await touchEntry(db, prev.date);
        } else {
          await db.entries.delete(dates[i]!);
          await buryEntry(db, dates[i]!, now);
        }
      }
    });
    notifyLocalChange();
    return true;
  } catch (err) {
    console.error('restoreDays failed:', err);
    return false;
  }
}

/** Forgot-PIN recovery: erase every entry and setting on this device. */
export async function eraseAllData(): Promise<boolean> {
  try {
    // Local only: clears sync bookkeeping too, never touches the server
    // (ADR-054). The session lives in settings, so this also signs out.
    bumpSessionEpoch();
    // Stop this device's push reminders: the push service then tells the
    // server the subscription is gone (ADR-055).
    void unsubscribeThisDevice();
    await db.transaction('rw', [db.entries, db.settings, db.tombstones, db.outbox, db.syncState], async () => {
      await db.entries.clear();
      await db.settings.clear();
      await db.tombstones.clear();
      await db.outbox.clear();
      await db.syncState.clear();
    });
    return true;
  } catch (err) {
    console.error('eraseAllData failed:', err);
    return false;
  }
}

/** Writes an imported payload (see lib/import.ts): entries upsert by date
 * (bulkPut, same overwrite-by-date semantics saveEntry already uses), and
 * only the three cycle settings an import actually restores — never the
 * device-specific ones (PIN, sound, theme, draft) an export payload also
 * carries. Also flips onboardingComplete so a device importing real history
 * isn't sent through onboarding after. */
export async function importData(
  entries: Entry[],
  settings: Pick<Settings, 'lastPeriodStart' | 'avgCycleLength' | 'avgPeriodLength'>,
): Promise<boolean> {
  try {
    // One transaction: a half-applied import (entries in, settings not) is
    // worse than none.
    // Restoring is a deliberate act, so it wins: fresh stamps, queued to sync
    // (ADR-054). Locally it already overwrote by date.
    const now = Date.now();
    await db.transaction('rw', [...ENTRY_WRITE(), db.settings, db.syncState], async () => {
      await db.entries.bulkPut(entries.map((e) => ({ ...e, updatedAt: now })));
      for (const e of entries) await touchEntry(db, e.date);
      await touchSettings(db, settings, now);
      await db.settings.bulkPut([
        { key: 'lastPeriodStart', value: settings.lastPeriodStart },
        { key: 'avgCycleLength', value: settings.avgCycleLength },
        { key: 'avgPeriodLength', value: settings.avgPeriodLength },
        { key: 'onboardingComplete', value: true },
      ]);
    });
    notifyLocalChange();
    return true;
  } catch (err) {
    console.error('importData failed:', err);
    return false;
  }
}
