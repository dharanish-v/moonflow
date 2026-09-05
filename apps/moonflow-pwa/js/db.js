// @ts-check
// db.js — Dexie schema. See moonflow-technical-design.md for the full spec.

import Dexie from './vendor/dexie.mjs';

export const db = new Dexie('MoonflowDB');

db.version(1).stores({
  entries: 'date',   // primary key = "YYYY-MM-DD" — one row per day, upsert by date (never append)
  settings: 'key'     // simple key-value table for app config
});

// Future fields (BBT, ovulation-test results, etc.) get added via db.version(2).stores({...})
// per Dexie's migration model — never by mutating version 1 in place.

/** @type {Record<string, any>} */
export const SETTINGS_DEFAULTS = {
  onboardingComplete: false,
  lastPeriodStart: null,
  avgCycleLength: 28,
  avgPeriodLength: 5,
  pinHash: null,
  pinLockEnabled: false,
  pinFailedAttempts: 0,
  pinLockoutUntil: null,
  soundEnabled: false,
  draftEntry: null
};

/**
 * Read one setting, falling back to its documented default if never set.
 * @param {string} key
 */
export async function getSetting(key) {
  try {
    const row = await db.settings.get(key);
    return row ? row.value : SETTINGS_DEFAULTS[key];
  } catch (err) {
    console.error(`getSetting(${key}) failed:`, err);
    return SETTINGS_DEFAULTS[key];
  }
}

/**
 * Write one setting.
 * @param {string} key
 * @param {*} value
 */
export async function setSetting(key, value) {
  try {
    await db.settings.put({ key, value });
    return true;
  } catch (err) {
    console.error(`setSetting(${key}) failed:`, err);
    return false; // caller shows the plain inline "Couldn't save — try again" error (see edge-case rules)
  }
}

/** Load every setting at once, merged over the defaults — used once at boot. */
export async function loadAllSettings() {
  try {
    const rows = await db.settings.toArray();
    const settings = { ...SETTINGS_DEFAULTS };
    for (const row of rows) settings[row.key] = row.value;
    return settings;
  } catch (err) {
    console.error('loadAllSettings failed:', err);
    return { ...SETTINGS_DEFAULTS };
  }
}

/**
 * Save (upsert) a day's log entry by date — never appends, per the data-safety rules.
 * @param {{date: string, flow: string|null, symptoms: string[], mood: string|null, note: string}} entry
 */
export async function saveEntry(entry) {
  try {
    await db.entries.put({ ...entry, updatedAt: Date.now() });
    return true;
  } catch (err) {
    console.error('saveEntry failed:', err);
    return false;
  }
}

/** Load every logged entry, sorted by date ascending. */
export async function loadAllEntries() {
  try {
    return await db.entries.orderBy('date').toArray();
  } catch (err) {
    console.error('loadAllEntries failed:', err);
    return [];
  }
}

/** @param {string} date */
export async function deleteEntry(date) {
  try {
    await db.entries.delete(date);
    return true;
  } catch (err) {
    console.error('deleteEntry failed:', err);
    return false;
  }
}
