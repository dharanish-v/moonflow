import { describe, expect, it } from 'vitest';
import { SETTINGS_DEFAULTS } from './db';
import { predictedStarts, reminderTimes } from './reminder-dates';
import type { Entry } from './types';

describe('reminder dates (ADR-055)', () => {
  it('reminds at 9:00 local time the day before each start, future only', () => {
    const now = new Date(2026, 10, 1, 12, 0).getTime();
    const times = reminderTimes(['2026-11-01', '2026-11-02', '2026-11-29'], now);
    expect(times.map((t) => new Date(t * 1000).toString())).toEqual([
      new Date(2026, 10, 28, 9, 0).toString(),
    ]);
    expect(reminderTimes(['2026-11-03'], now)).toEqual([new Date(2026, 10, 2, 9, 0).getTime() / 1000]);
  });

  it('has nothing to remind about while predictions are paused', () => {
    const entries: Entry[] = [{ date: '2026-10-20', flow: 'medium', symptoms: [], mood: null, note: '', updatedAt: 1 }];
    const settings = { ...SETTINGS_DEFAULTS, lastPeriodStart: '2026-10-20', onboardingComplete: true };
    expect(predictedStarts(entries, { ...settings, predictionsPaused: true })).toEqual([]);
  });
});
