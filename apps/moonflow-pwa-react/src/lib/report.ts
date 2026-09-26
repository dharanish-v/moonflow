// src/lib/report.ts — data for the printable doctor report (T66): the last
// 12 months of periods, cycle stats and symptom frequency. Pure.
import { SYMPTOM_OPTIONS } from './constants';
import { addDays, derivePeriods, diffDays, formatDate } from './cycle-math';
import { computeForecast } from './forecast';
import type { Entry, SymptomId } from './types';

export interface ReportPeriod {
  start: string;
  days: number;
  /** Days from this period's start to the next one's; null for the latest. */
  cycleLength: number | null;
}

export interface Report {
  from: string;
  to: string;
  periods: ReportPeriod[];
  typicalCycle: number | null;
  shortestCycle: number | null;
  longestCycle: number | null;
  typicalPeriod: number | null;
  symptoms: Array<{ label: string; days: number }>;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
};

export function buildReport(entries: Entry[], today: Date = new Date()): Report {
  const to = formatDate(today);
  const from = addDays(to, -365);
  const inRange = entries.filter((e) => e.date >= from && e.date <= to);
  const periods = derivePeriods(inRange);
  const rows: ReportPeriod[] = periods.map((p, i) => ({
    start: p.start,
    days: diffDays(p.start, p.end) + 1,
    cycleLength: periods[i + 1] ? diffDays(p.start, periods[i + 1]!.start) : null,
  }));
  const cycles = computeForecast(inRange, { lastPeriodStart: null, avgCycleLength: 28, avgPeriodLength: 5 }, today).usedCycleLengths;

  const counts = new Map<SymptomId, number>();
  for (const e of inRange) for (const s of e.symptoms) counts.set(s, (counts.get(s) ?? 0) + 1);
  const symptoms = [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([id, days]) => ({ label: SYMPTOM_OPTIONS.find((o) => o.id === id)?.label ?? id, days }));

  return {
    from,
    to,
    periods: rows,
    typicalCycle: cycles.length ? median(cycles) : null,
    shortestCycle: cycles.length ? Math.min(...cycles) : null,
    longestCycle: cycles.length ? Math.max(...cycles) : null,
    typicalPeriod: rows.length ? median(rows.map((r) => r.days)) : null,
    symptoms,
  };
}
