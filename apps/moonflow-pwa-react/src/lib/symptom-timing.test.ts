import { describe, expect, it } from 'vitest';
import { symptomTiming } from './symptom-timing';
import type { Entry, FlowId, SymptomId } from './types';

const d = (date: string, flow: FlowId | null, symptoms: SymptomId[] = []): Entry => ({ date, flow, symptoms, mood: null, note: '', updatedAt: 0 });

// Periods start 1 Mar, 29 Mar, 26 Apr, 24 May (28-day cycles).
const PERIODS = ['2026-03-01', '2026-03-29', '2026-04-26', '2026-05-24'];

describe('symptomTiming', () => {
  it('finds a symptom that clusters at the start of the period', () => {
    const entries = [
      ...PERIODS.map((p) => d(p, 'medium', ['cramps'])),
      d('2026-03-02', 'medium', ['cramps']),
      d('2026-03-30', 'medium', ['cramps']),
    ];
    expect(symptomTiming(entries)).toContainEqual({ id: 'cramps', label: 'Cramps', text: 'usually around days 1–2' });
  });

  it('describes a pre-period symptom relative to the next period', () => {
    const entries = [
      ...PERIODS.map((p) => d(p, 'medium')),
      d('2026-03-27', null, ['headache']), // 2 days before 29 Mar
      d('2026-04-24', null, ['headache']), // 2 days before 26 Apr
      d('2026-05-21', null, ['headache']), // 3 days before 24 May
    ];
    expect(symptomTiming(entries)).toContainEqual({ id: 'headache', label: 'Headache', text: 'usually 2–3 days before your period' });
  });

  it('needs the pattern in at least two cycles before saying anything', () => {
    const entries = [...PERIODS.map((p) => d(p, 'medium')), d('2026-03-10', null, ['acne']), d('2026-03-11', null, ['acne'])];
    expect(symptomTiming(entries).map((s) => s.id)).not.toContain('acne');
  });
});
