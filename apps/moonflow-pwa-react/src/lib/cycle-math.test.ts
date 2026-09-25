// Period detection. Prediction is covered by forecast.test.ts.
import { describe, expect, it } from 'vitest';
import { derivePeriods } from './cycle-math';

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
