// Ported 1:1 from tests/cycle-math-tests.html — same 8 assertions.
import { describe, expect, it } from 'vitest';
import { derivePeriods, estimateFertileWindow, predictNextPeriod } from './cycle-math';

describe('derivePeriods', () => {
  it('groups consecutive flow days into one period', () => {
    const periods = derivePeriods([
      { date: '2026-09-01', flow: 'light' },
      { date: '2026-09-02', flow: 'medium' },
      { date: '2026-09-03', flow: 'medium' },
    ]);
    expect(periods).toHaveLength(1);
    expect(periods[0]).toEqual({ start: '2026-09-01', end: '2026-09-03' });
  });

  it('excludes spotting-only days from period boundaries', () => {
    const periods = derivePeriods([
      { date: '2026-08-20', flow: 'spotting' },
      { date: '2026-09-01', flow: 'light' },
    ]);
    expect(periods).toHaveLength(1);
    expect(periods[0]!.start).toBe('2026-09-01');
  });

  it('treats a 1-day gap as the same period (missed-log tolerance)', () => {
    const periods = derivePeriods([
      { date: '2026-09-01', flow: 'medium' },
      { date: '2026-09-03', flow: 'light' },
    ]);
    expect(periods).toHaveLength(1);
  });

  it('treats a 3+ day gap as two separate periods', () => {
    const periods = derivePeriods([
      { date: '2026-08-05', flow: 'medium' },
      { date: '2026-09-01', flow: 'light' },
    ]);
    expect(periods).toHaveLength(2);
  });
});

describe('predictNextPeriod', () => {
  it('falls back to the onboarding average with fewer than 2 real periods', () => {
    const result = predictNextPeriod([{ start: '2026-08-01', end: '2026-08-05' }], {
      avgCycleLength: 28,
      lastPeriodStart: '2026-08-01',
    });
    expect(result.confidence).toBe('estimated');
  });

  it('uses the median cycle length once 2+ periods exist', () => {
    const result = predictNextPeriod(
      [{ start: '2026-06-01', end: '2026-06-01' }, { start: '2026-06-29', end: '2026-06-29' }, { start: '2026-07-27', end: '2026-07-27' }],
      { avgCycleLength: 28, lastPeriodStart: null },
    );
    expect(result.confidence).toBe('confirmed');
    expect(result.date).toBe('2026-08-24');
  });

  it('returns a range, not a false-precision date, when history is highly variable', () => {
    const result = predictNextPeriod(
      [{ start: '2026-04-01', end: '2026-04-01' }, { start: '2026-04-25', end: '2026-04-25' }, { start: '2026-06-05', end: '2026-06-05' }],
      { avgCycleLength: 28, lastPeriodStart: null },
    );
    expect(result.confidence).toBe('wide');
    expect(result.rangeStart).toBeTruthy();
    expect(result.rangeEnd).toBeTruthy();
  });
});

describe('estimateFertileWindow', () => {
  it('places ovulation 14 days before the predicted period', () => {
    const window = estimateFertileWindow('2026-09-29');
    expect(window.peak).toBe('2026-09-15');
  });
});
