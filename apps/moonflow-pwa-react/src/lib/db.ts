// src/lib/db.ts — Dexie schema, typed. Ported verbatim from db.js — same DB
// name (MoonflowDB), same entries/settings schema, so existing on-device data
// carries over on same-origin deploy with zero migration script.

import Dexie, { type Table } from 'dexie';
import type { Entry, LogEntryInput, Settings, SettingKey } from './types';

interface SettingRow<K extends SettingKey = SettingKey> {
  key: K;
  value: Settings[K];
}

class MoonflowDB extends Dexie {
  entries!: Table<Entry, string>;
  settings!: Table<SettingRow, string>;

  constructor() {
    super('MoonflowDB');
    this.version(1).stores({
      entries: 'date', // primary key = "YYYY-MM-DD" — one row per day, upsert by date (never append)
      settings: 'key',
    });
    // Future fields (BBT, ovulation-test results, etc.) get added via
    // this.version(2).stores({...}) per Dexie's migration model — never by
    // mutating version 1 in place.
  }
}

export const db = new MoonflowDB();

export const SETTINGS_DEFAULTS: Settings = {
  onboardingComplete: false,
  lastPeriodStart: null,
  avgCycleLength: 28,
  avgPeriodLength: 5,
  pinHash: null,
  pinLockEnabled: false,
  pinFailedAttempts: 0,
  pinLockoutUntil: null,
  soundEnabled: false,
  draftEntry: null,
  themeMode: 'system',
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
    await db.settings.put({ key, value });
    return true;
  } catch (err) {
    console.error(`setSetting(${key}) failed:`, err);
    return false; // caller shows the plain inline "Couldn't save — try again" error (see edge-case rules)
  }
}

/** Load every setting at once, merged over the defaults — used once at boot. */
export async function loadAllSettings(): Promise<Settings> {
  try {
    const rows = await db.settings.toArray();
    const settings = { ...SETTINGS_DEFAULTS };
    for (const row of rows) {
      (settings as Record<string, unknown>)[row.key] = row.value;
    }
    return settings;
  } catch (err) {
    console.error('loadAllSettings failed:', err);
    return { ...SETTINGS_DEFAULTS };
  }
}

/** Save (upsert) a day's log entry by date — never appends, per the data-safety rules. */
export async function saveEntry(entry: LogEntryInput): Promise<boolean> {
  try {
    await db.entries.put({ ...entry, updatedAt: Date.now() });
    return true;
  } catch (err) {
    console.error('saveEntry failed:', err);
    return false;
  }
}

/** Load every logged entry, sorted by date ascending. */
export async function loadAllEntries(): Promise<Entry[]> {
  try {
    return await db.entries.orderBy('date').toArray();
  } catch (err) {
    console.error('loadAllEntries failed:', err);
    return [];
  }
}

export async function deleteEntry(date: string): Promise<boolean> {
  try {
    await db.entries.delete(date);
    return true;
  } catch (err) {
    console.error('deleteEntry failed:', err);
    return false;
  }
}
