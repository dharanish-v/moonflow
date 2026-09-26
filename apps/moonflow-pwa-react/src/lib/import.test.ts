import { describe, expect, it } from 'vitest';
import { buildExportPayload } from './export';
import { parseImportPayload } from './import';
import type { Entry, Settings } from './types';

const ENTRY: Entry = { date: '2026-09-04', flow: 'medium', symptoms: ['cramps'], mood: 'neutral', note: 'hi', tags: [], updatedAt: 123 };

describe('parseImportPayload', () => {
  it('round-trips a real export payload', () => {
    const settings = { lastPeriodStart: '2026-09-01', avgCycleLength: 30, avgPeriodLength: 6, pinHash: 'secret' } as unknown as Settings;
    const json = buildExportPayload([ENTRY], settings, '2026-09-04T12:00:00.000Z');

    const result = parseImportPayload(json);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.entries).toEqual([ENTRY]);
    expect(result.payload.settings).toEqual({ lastPeriodStart: '2026-09-01', avgCycleLength: 30, avgPeriodLength: 6 });
    expect(result.skippedEntries).toBe(0);
  });

  it('drops device-specific settings (PIN, sound, theme, draft) from the imported payload', () => {
    const settings = {
      lastPeriodStart: null,
      avgCycleLength: 28,
      avgPeriodLength: 5,
      pinHash: 'should-not-carry-over',
      pinLockEnabled: true,
      soundEnabled: true,
      themeMode: 'dark',
      draftEntry: { date: '2026-09-01', flow: 'light', symptoms: [], mood: null, note: 'draft' },
    } as unknown as Settings;
    const json = buildExportPayload([], settings, '2026-09-04T12:00:00.000Z');

    const result = parseImportPayload(json);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.settings).toEqual({ lastPeriodStart: null, avgCycleLength: 28, avgPeriodLength: 5 });
  });

  it('rejects invalid JSON', () => {
    const result = parseImportPayload('not json{');
    expect(result).toEqual({ ok: false, error: "That file isn't valid JSON." });
  });

  it("rejects a well-formed JSON file that isn't a Moonflow export", () => {
    const result = parseImportPayload(JSON.stringify({ hello: 'world' }));
    expect(result.ok).toBe(false);
  });

  it('drops individually malformed entries but keeps the valid ones', () => {
    const json = JSON.stringify({
      entries: [ENTRY, { date: 'not-a-date' }, { date: '2026-09-05', flow: 'not-a-real-flow-id', symptoms: [], mood: null, note: '' }],
      settings: { lastPeriodStart: null, avgCycleLength: 28, avgPeriodLength: 5 },
    });

    const result = parseImportPayload(json);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.entries).toEqual([ENTRY]);
    expect(result.skippedEntries).toBe(2);
  });

  it('falls back to defaults for missing/invalid settings fields', () => {
    const json = JSON.stringify({ entries: [], settings: {} });

    const result = parseImportPayload(json);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.settings).toEqual({ lastPeriodStart: null, avgCycleLength: 28, avgPeriodLength: 5 });
  });
});

describe('parseImportPayload — hardening (T38)', () => {
  it('drops entries on impossible dates like 30 February', () => {
    const json = JSON.stringify({
      entries: [ENTRY, { ...ENTRY, date: '2026-02-30' }],
      settings: { lastPeriodStart: null, avgCycleLength: 28, avgPeriodLength: 5 },
    });
    const result = parseImportPayload(json);
    expect(result.ok && result.payload.entries).toEqual([ENTRY]);
    expect(result.ok && result.skippedEntries).toBe(1);
  });

  it('clamps cycle and period lengths into the app\'s supported range', () => {
    const json = JSON.stringify({ entries: [], settings: { lastPeriodStart: '2026-09-01', avgCycleLength: 0, avgPeriodLength: 999 } });
    const result = parseImportPayload(json);
    expect(result.ok && result.payload.settings).toEqual({ lastPeriodStart: '2026-09-01', avgCycleLength: 15, avgPeriodLength: 14 });
  });

  it('rejects an impossible lastPeriodStart', () => {
    const json = JSON.stringify({ entries: [], settings: { lastPeriodStart: '2026-02-30', avgCycleLength: 28, avgPeriodLength: 5 } });
    const result = parseImportPayload(json);
    expect(result.ok && result.payload.settings.lastPeriodStart).toBeNull();
  });

  it('rejects files from a newer, unknown export format', () => {
    const result = parseImportPayload(JSON.stringify({ schemaVersion: 99, entries: [], settings: {} }));
    expect(result.ok).toBe(false);
  });

  it('rejects absurdly large files before parsing', () => {
    const result = parseImportPayload('x'.repeat(21 * 1024 * 1024));
    expect(result.ok).toBe(false);
  });

  it('drops notes over the length limit rather than storing them', () => {
    const json = JSON.stringify({ entries: [{ ...ENTRY, note: 'a'.repeat(10_001) }], settings: {} });
    const result = parseImportPayload(json);
    expect(result.ok && result.skippedEntries).toBe(1);
  });
});

describe('parseImportPayload — tags (T68)', () => {
  it('keeps valid tags and drops entries with malformed ones', () => {
    const json = JSON.stringify({
      entries: [{ ...ENTRY, tags: ['Pill taken'] }, { ...ENTRY, date: '2026-09-05', tags: [42] }],
      settings: {},
    });
    const r = parseImportPayload(json);
    expect(r.ok && r.payload.entries.map((e) => e.tags)).toEqual([['Pill taken']]);
    expect(r.ok && r.skippedEntries).toBe(1);
  });

  it('treats entries from before tags existed as having none', () => {
    const r = parseImportPayload(JSON.stringify({ entries: [ENTRY], settings: {} }));
    expect(r.ok && r.payload.entries[0]!.tags).toEqual([]);
  });
});

describe('parseImportPayload — fertility awareness (T88)', () => {
  it('keeps valid temperature and mucus, drops impossible ones', () => {
    const json = JSON.stringify({
      entries: [
        { ...ENTRY, temperature: 36.6, mucus: 'creamy', tempDisturbed: false },
        { ...ENTRY, date: '2026-09-05', temperature: 55 },
        { ...ENTRY, date: '2026-09-03', mucus: 'lava' },
      ],
      settings: {},
    });
    const r = parseImportPayload(json);
    expect(r.ok && r.payload.entries.map((e) => e.temperature)).toEqual([36.6]);
    expect(r.ok && r.skippedEntries).toBe(2);
  });
});
