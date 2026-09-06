import { describe, expect, it } from 'vitest';
import { formatHeaderDate, resolveInitialDraft } from './log-entry';
import type { Entry, LogEntryInput } from './types';

const EXISTING: Entry = {
  date: '2026-09-01',
  flow: 'medium',
  symptoms: ['cramps'],
  mood: 'sad',
  note: 'existing note',
  updatedAt: 0,
};

describe('resolveInitialDraft', () => {
  it('prefers a same-date draft over an existing saved entry', () => {
    const draft: LogEntryInput = {
      date: '2026-09-01',
      flow: 'heavy',
      symptoms: [],
      mood: 'cry',
      note: 'draft note',
    };
    const result = resolveInitialDraft('2026-09-01', EXISTING, draft);
    expect(result.flow).toBe('heavy');
    expect(result.fromDraft).toBe(true);
  });

  it('ignores a draft for a different date entirely', () => {
    const draft: LogEntryInput = { date: '2026-08-31', flow: 'heavy', symptoms: [], mood: null, note: '' };
    const result = resolveInitialDraft('2026-09-01', EXISTING, draft);
    expect(result.flow).toBe('medium');
    expect(result.fromDraft).toBe(false);
  });

  it('falls back to blank defaults with neither an entry nor a draft', () => {
    const result = resolveInitialDraft('2026-09-05', null, null);
    expect(result).toEqual({ flow: null, symptoms: [], mood: null, note: '', fromDraft: false });
  });
});

describe('formatHeaderDate', () => {
  // toLocaleDateString(undefined, ...) deliberately follows the device's own
  // locale (an intentional i18n choice, not a bug) — so these assert
  // structure, not one hardcoded locale's exact string.
  it('labels the current day with a "Today, " prefix', () => {
    expect(formatHeaderDate('2026-09-06', new Date(2026, 8, 6))).toMatch(/^Today, /);
  });

  it('labels any other day with just the date, no "Today" prefix', () => {
    expect(formatHeaderDate('2026-09-01', new Date(2026, 8, 6))).not.toMatch(/^Today/);
  });
});
