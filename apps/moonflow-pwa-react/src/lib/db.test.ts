// New coverage — db.js/db.ts had zero prior tests. Exercises real IndexedDB
// semantics via fake-indexeddb, not mocked field-level behavior, so the
// upsert-by-date row-count property (the actual data-safety invariant) is
// verified for real, not assumed from reading the Dexie call.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, deleteEntry, getSetting, loadAllEntries, loadAllSettings, saveEntry, setSetting, SETTINGS_DEFAULTS } from './db';

beforeEach(async () => {
  await db.entries.clear();
  await db.settings.clear();
});

describe('saveEntry', () => {
  it('upserts by date — saving the same date twice never appends a second row', async () => {
    await saveEntry({ date: '2026-09-04', flow: 'medium', symptoms: [], mood: null, note: '' });
    await saveEntry({ date: '2026-09-04', flow: 'heavy', symptoms: ['cramps'], mood: 'sad', note: 'updated' });

    const rows = await loadAllEntries();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.flow).toBe('heavy');
    expect(rows[0]!.symptoms).toEqual(['cramps']);
  });

  it('stamps updatedAt on write', async () => {
    const before = Date.now();
    await saveEntry({ date: '2026-09-04', flow: 'light', symptoms: [], mood: null, note: '' });
    const [row] = await loadAllEntries();
    expect(row!.updatedAt).toBeGreaterThanOrEqual(before);
  });
});

describe('loadAllEntries', () => {
  it('returns entries sorted by date ascending', async () => {
    await saveEntry({ date: '2026-09-10', flow: 'light', symptoms: [], mood: null, note: '' });
    await saveEntry({ date: '2026-09-01', flow: 'medium', symptoms: [], mood: null, note: '' });
    const rows = await loadAllEntries();
    expect(rows.map((r) => r.date)).toEqual(['2026-09-01', '2026-09-10']);
  });
});

describe('deleteEntry', () => {
  it('removes the row for that date only', async () => {
    await saveEntry({ date: '2026-09-01', flow: 'light', symptoms: [], mood: null, note: '' });
    await saveEntry({ date: '2026-09-02', flow: 'medium', symptoms: [], mood: null, note: '' });
    await deleteEntry('2026-09-01');
    const rows = await loadAllEntries();
    expect(rows.map((r) => r.date)).toEqual(['2026-09-02']);
  });
});

describe('settings', () => {
  it('getSetting falls back to the documented default when never set', async () => {
    expect(await getSetting('avgCycleLength')).toBe(SETTINGS_DEFAULTS.avgCycleLength);
  });

  it('setSetting then getSetting round-trips the value', async () => {
    await setSetting('avgCycleLength', 30);
    expect(await getSetting('avgCycleLength')).toBe(30);
  });

  it('loadAllSettings merges stored values over the defaults', async () => {
    await setSetting('pinLockEnabled', true);
    const settings = await loadAllSettings();
    expect(settings).toEqual({ ...SETTINGS_DEFAULTS, pinLockEnabled: true });
  });
});
