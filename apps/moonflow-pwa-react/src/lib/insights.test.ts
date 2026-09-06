import { describe, expect, it } from 'vitest';
import { computeInsights } from './insights';
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
