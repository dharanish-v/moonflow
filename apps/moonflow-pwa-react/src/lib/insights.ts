// src/lib/insights.ts — ported from insights.js's computeInsights. Local
// median/stdDev, deliberately duplicated rather than imported from
// cycle-math.ts's own module-private copies — same duplication choice the
// vanilla app made.
import { SYMPTOM_OPTIONS } from './constants';
import { derivePeriods, diffDays } from './cycle-math';
import type { Entry, SymptomId } from './types';

function median(numbers: number[]): number {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function stdDev(numbers: number[]): number {
  const avg = numbers.reduce((s, n) => s + n, 0) / numbers.length;
  return Math.sqrt(numbers.reduce((s, n) => s + (n - avg) ** 2, 0) / numbers.length);
}

export interface TopSymptom {
  id: SymptomId;
  label: string;
  percent: number;
}

export interface Insights {
  hasEnoughHistory: boolean;
  avgCycleLength: number | null;
  avgPeriodLength: number | null;
  variability: number | null;
  cyclesLogged: number;
  recentCycleLengths: number[];
  topSymptoms: TopSymptom[];
}

export function computeInsights(entries: Array<Pick<Entry, 'date' | 'flow' | 'symptoms'>>): Insights {
  const periods = derivePeriods(entries);
  const hasEnoughHistory = periods.length >= 2;

  const cycleLengths: number[] = [];
  for (let i = 1; i < periods.length; i++) {
    cycleLengths.push(diffDays(periods[i - 1]!.start, periods[i]!.start));
  }
  const periodLengths = periods.map((p) => diffDays(p.start, p.end) + 1);

  const symptomCounts: Partial<Record<SymptomId, number>> = {};
  let daysWithAnyLog = 0;
  for (const e of entries) {
    if (e.symptoms.length) daysWithAnyLog++;
    for (const s of e.symptoms) symptomCounts[s] = (symptomCounts[s] ?? 0) + 1;
  }

  const topSymptoms: TopSymptom[] = (Object.entries(symptomCounts) as Array<[SymptomId, number]>)
    .map(([id, count]) => ({
      id,
      label: SYMPTOM_OPTIONS.find((s) => s.id === id)?.label ?? id,
      percent: daysWithAnyLog > 0 ? Math.round((count / daysWithAnyLog) * 100) : 0,
    }))
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 3);

  return {
    hasEnoughHistory,
    avgCycleLength: hasEnoughHistory ? Math.round(median(cycleLengths)) : null,
    avgPeriodLength: periodLengths.length ? Math.round(median(periodLengths)) : null,
    variability: hasEnoughHistory ? Math.round(stdDev(cycleLengths)) : null,
    cyclesLogged: periods.length,
    recentCycleLengths: cycleLengths.slice(-6),
    topSymptoms,
  };
}
