import { describe, expect, it } from 'vitest';
import { buildExportPayload } from './export';
import { parseImportPayload } from './import';
import type { Entry, Settings } from './types';

const ENTRY: Entry = { date: '2026-09-04', flow: 'medium', symptoms: ['cramps'], mood: 'neutral', note: 'hi', updatedAt: 123 };

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
