// Ported 1:1 from tests/export-tests.html — same 3 assertions.
import { describe, expect, it } from 'vitest';
import { buildExportPayload, exportFilename } from './export';
import type { Entry, Settings } from './types';

describe('buildExportPayload', () => {
  it('round-trips entries, settings, and exportedAt exactly', () => {
    const entries: Entry[] = [
      { date: '2026-09-04', flow: 'medium', symptoms: ['cramps'], mood: 'neutral', note: '', updatedAt: 0 },
    ];
    const settings = { avgCycleLength: 28, avgPeriodLength: 5, pinHash: 'shouldnt-matter-here' } as unknown as Settings;
    const json = buildExportPayload(entries, settings, '2026-09-04T12:00:00.000Z');
    const parsed = JSON.parse(json);
    expect(parsed.entries).toEqual(entries);
    expect(parsed.settings).toEqual(settings);
    expect(parsed.exportedAt).toBe('2026-09-04T12:00:00.000Z');
  });

  it('produces valid, parseable JSON even with zero entries', () => {
    const json = buildExportPayload([], {} as Settings, '2026-09-04T12:00:00.000Z');
    const parsed = JSON.parse(json);
    expect(parsed.entries).toEqual([]);
  });
});

describe('exportFilename', () => {
  it('formats a date-stamped .json filename', () => {
    expect(exportFilename('2026-09-04')).toBe('moonflow-export-2026-09-04.json');
  });
});
