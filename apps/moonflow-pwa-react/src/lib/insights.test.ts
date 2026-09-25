import { describe, expect, it } from 'vitest';
import { computeInsights, cycleBarHeight } from './insights';
import type { Entry } from './types';

function entry(overrides: Partial<Entry> & Pick<Entry, 'date'>): Entry {
  return { flow: null, symptoms: [], mood: null, note: '', updatedAt: 0, ...overrides };
}

describe('computeInsights', () => {
  it('reports not-enough-history with fewer than 2 real periods', () => {
    const result = computeInsights([entry({ date: '2026-08-01', flow: 'medium' })]);
    expect(result.hasEnoughHistory).toBe(false);
    expect(result.avgCycleLength).toBeNull();
  });

  it('computes avg cycle/period length and count once 2+ periods exist', () => {
    const result = computeInsights([
      entry({ date: '2026-06-01', flow: 'medium' }),
      entry({ date: '2026-06-02', flow: 'medium' }),
      entry({ date: '2026-06-29', flow: 'medium' }),
      entry({ date: '2026-06-30', flow: 'medium' }),
    ]);
    expect(result.hasEnoughHistory).toBe(true);
    expect(result.avgCycleLength).toBe(28);
    expect(result.avgPeriodLength).toBe(2);
    expect(result.cyclesLogged).toBe(2);
  });

  it('ignores impossible cycles and likely missed logs, same as the prediction does', () => {
    const med = (date: string) => entry({ date, flow: 'medium' });
    const result = computeInsights([
      med('2026-01-01'),
      med('2026-01-29'),
      med('2026-02-26'),
      med('2026-04-23'), // 56-day gap: a period was never logged
      med('2026-05-21'),
      med('2026-05-26'), // 5 days later: not a new cycle
    ]);
    expect(result.avgCycleLength).toBe(28);
    expect(result.variability).toBe(0);
    expect(result.recentCycleLengths).toEqual([28, 28, 28]);
    expect(result.suspectedMissedCycles).toBe(1);
  });

  it('ranks top symptoms by percent of logged days, capped at 3', () => {
    const result = computeInsights([
      entry({ date: '2026-06-01', symptoms: ['cramps', 'bloating'] }),
      entry({ date: '2026-06-02', symptoms: ['cramps'] }),
      entry({ date: '2026-06-03', symptoms: ['headache'] }),
      entry({ date: '2026-06-04', symptoms: ['fatigue'] }),
      entry({ date: '2026-06-05', symptoms: ['nausea'] }),
    ]);
    expect(result.topSymptoms).toHaveLength(3);
    expect(result.topSymptoms[0]!.id).toBe('cramps');
    expect(result.topSymptoms[0]!.percent).toBe(40);
  });

  it('days with no symptoms logged do not count toward the symptom-frequency denominator', () => {
    const result = computeInsights([
      entry({ date: '2026-06-01', symptoms: ['cramps'] }),
      entry({ date: '2026-06-02', symptoms: [] }),
    ]);
    expect(result.topSymptoms[0]!.percent).toBe(100);
  });
});

describe('cycleBarHeight', () => {
  it('never exceeds the chart height, even for a 90-day cycle', () => {
    expect(cycleBarHeight(90, [28, 90], 64)).toBeLessThanOrEqual(64);
    expect(cycleBarHeight(45, [45], 64)).toBeLessThanOrEqual(64);
  });

  it('keeps short cycles visible and orders bars by length', () => {
    const lengths = [24, 28, 35];
    const [a, b, c] = lengths.map((l) => cycleBarHeight(l, lengths, 64));
    expect(a).toBeGreaterThanOrEqual(8);
    expect(a!).toBeLessThan(b!);
    expect(b!).toBeLessThan(c!);
  });
});
