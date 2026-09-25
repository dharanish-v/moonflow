// src/lib/insights.ts — Insights screen data. Cycle statistics come from the
// shared forecast (forecast.ts), so Insights uses exactly the cycles the
// prediction uses: impossible (<15/>90 day) cycles and likely missed logs are
// excluded here too, instead of dragging the averages around.
import { SYMPTOM_OPTIONS } from './constants';
import { diffDays, derivePeriods } from './cycle-math';
import { computeForecast } from './forecast';
import type { Entry, SymptomId } from './types';

function median(numbers: number[]): number {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
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
  /** Gaps long enough that a period was probably never logged. */
  suspectedMissedCycles: number;
  topSymptoms: TopSymptom[];
}

export function computeInsights(entries: Array<Pick<Entry, 'date' | 'flow' | 'symptoms'>>): Insights {
  const periods = derivePeriods(entries);
  const forecast = computeForecast(entries, { lastPeriodStart: null, avgCycleLength: 28, avgPeriodLength: 5 });
  const cycleLengths = forecast.usedCycleLengths;
  const hasEnoughHistory = cycleLengths.length >= 1;
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
    // Spread between shortest and longest recent cycle — the FIGO regularity measure.
    variability: hasEnoughHistory ? Math.max(...cycleLengths) - Math.min(...cycleLengths) : null,
    cyclesLogged: periods.length,
    recentCycleLengths: cycleLengths,
    suspectedMissedCycles: forecast.suspectedMissedCycles.length,
    topSymptoms,
  };
}

/** Bar height in px for the cycle-length chart: 15 days (shortest valid
 * cycle) sits at the floor, the longest bar (≥45 days of scale) fills the
 * chart — never overflowing it the way the old fixed px-per-day scale did. */
export function cycleBarHeight(length: number, all: number[], chartHeight: number): number {
  const floor = 15;
  const ceiling = Math.max(45, ...all);
  const minBar = 8;
  const ratio = Math.min(1, Math.max(0, (length - floor) / (ceiling - floor)));
  return Math.round(minBar + ratio * (chartHeight - minBar));
}
