import { describe, expect, it } from 'vitest';
import { EXPORT_SCHEMA_VERSION, buildExportPayload, exportFilename, exportShareTitle } from './export';
import { SETTINGS_DEFAULTS } from './db';
import type { Entry, Settings } from './types';

const ENTRIES: Entry[] = [
  { date: '2026-09-04', flow: 'medium', symptoms: ['cramps'], mood: 'neutral', note: '', updatedAt: 0 },
];

const SETTINGS: Settings = {
  ...SETTINGS_DEFAULTS,
  onboardingComplete: true,
  lastPeriodStart: '2026-09-01',
  avgCycleLength: 30,
  avgPeriodLength: 6,
  pinHash: 'secret-hash',
  pinLockEnabled: true,
  pinFailedAttempts: 3,
  pinLockoutUntil: 123,
  themeMode: 'dark',
  draftEntry: { date: '2026-09-04', flow: 'light', symptoms: [], mood: null, note: 'draft' },
};

describe('buildExportPayload', () => {
  it('round-trips entries and exportedAt exactly, stamped with a schema version', () => {
    const parsed = JSON.parse(buildExportPayload(ENTRIES, SETTINGS, '2026-09-04T12:00:00.000Z'));
    expect(parsed.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
    expect(parsed.entries).toEqual(ENTRIES);
    expect(parsed.exportedAt).toBe('2026-09-04T12:00:00.000Z');
  });

  it('exports only the cycle settings — never the PIN hash, lockout state, draft, or theme', () => {
    const json = buildExportPayload(ENTRIES, SETTINGS, '2026-09-04T12:00:00.000Z');
    expect(JSON.parse(json).settings).toEqual({ lastPeriodStart: '2026-09-01', avgCycleLength: 30, avgPeriodLength: 6 });
    expect(json).not.toContain('secret-hash');
    expect(json).not.toContain('draft');
  });

  it('produces valid, parseable JSON even with zero entries', () => {
    const parsed = JSON.parse(buildExportPayload([], SETTINGS_DEFAULTS, '2026-09-04T12:00:00.000Z'));
    expect(parsed.entries).toEqual([]);
  });
});

describe('exportFilename / exportShareTitle', () => {
  it('uses the Moonflow name in the normal install', () => {
    expect(exportFilename('2026-09-04', false)).toBe('moonflow-export-2026-09-04.json');
    expect(exportShareTitle(false)).toBe('Moonflow export');
  });

  it('never names Moonflow in the discreet install', () => {
    expect(exportFilename('2026-09-04', true)).toBe('planner-backup-2026-09-04.json');
    expect(exportShareTitle(true)).toBe('Planner backup');
  });
});
