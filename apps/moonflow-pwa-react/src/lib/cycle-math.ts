// src/lib/cycle-math.ts — ported verbatim from the vanilla app's cycle-math.js.
// See technical-design.md for the algorithm pseudocode this implements, and
// the ported Vitest specs (cycle-math.test.ts) for the contract it must
// satisfy — same 8 assertions as the original cycle-math-tests.html.
//
// Note: no date-fns dependency here, despite earlier planning docs mentioning
// one. Date-only values (ADR-012) plus local-midnight construction and
// Math.round() on the day-count division are sufficient to be exactly
// DST-safe without a library — a single DST transition only ever contributes
// a ±1 hour (≤1/24 day) offset, which rounding always resolves back to the
// correct whole-day count.

import {
  FERTILE_WINDOW_AFTER_OVULATION_DAYS,
  FERTILE_WINDOW_BEFORE_OVULATION_DAYS,
  LUTEAL_PHASE_DAYS,
  PERIOD_FLOW_LEVELS,
  PERIOD_GAP_TOLERANCE_DAYS,
  VARIABILITY_THRESHOLD_DAYS,
} from './constants';
import type { Entry, FertileWindow, Period, PredictNextPeriodResult, Settings } from './types';

// --- Local date-only helpers ---

/** Parses "YYYY-MM-DD" to a local-midnight Date — deliberate, see file header. */
export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

/** Formats any Date to "YYYY-MM-DD" — local calendar date, not UTC. */
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayString(): string {
  return formatDate(new Date());
}

export function addDays(dateStr: string, days: number): string {
  const date = parseDate(dateStr);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

/** Whole calendar days from `fromStr` to `toStr`. DST-safe (see file header). */
export function diffDays(fromStr: string, toStr: string): number {
  const from = parseDate(fromStr);
  const to = parseDate(toStr);
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function median(numbers: number[]): number {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function stdDev(numbers: number[]): number {
  const avg = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  const variance = numbers.reduce((sum, n) => sum + (n - avg) ** 2, 0) / numbers.length;
  return Math.sqrt(variance);
}

// --- Core algorithms ---

/**
 * Groups logged days into periods. None and Spotting are excluded from
 * boundary detection — only Light/Medium/Heavy count as real period days.
 */
export function derivePeriods(entries: Array<Pick<Entry, 'date' | 'flow'>>): Period[] {
  const periodDays = entries
    .filter((e) => PERIOD_FLOW_LEVELS.includes(e.flow ?? ('' as never)))
    .map((e) => e.date)
    .sort();

  const periods: Period[] = [];
  let current: Period | null = null;

  for (const date of periodDays) {
    if (current === null) {
      current = { start: date, end: date };
    } else if (diffDays(current.end, date) <= PERIOD_GAP_TOLERANCE_DAYS) {
      current.end = date;
    } else {
      periods.push(current);
      current = { start: date, end: date };
    }
  }
  if (current) periods.push(current);
  return periods;
}

export function predictNextPeriod(
  periods: Period[],
  settings: Pick<Settings, 'avgCycleLength' | 'lastPeriodStart'>,
): PredictNextPeriodResult {
  if (periods.length < 2) {
    const lastStart = periods.length === 1 ? periods[0]!.start : settings.lastPeriodStart;
    return {
      date: addDays(lastStart as string, settings.avgCycleLength),
      confidence: 'estimated',
    };
  }

  const lengths: number[] = [];
  for (let i = 1; i < periods.length; i++) {
    lengths.push(diffDays(periods[i - 1]!.start, periods[i]!.start));
  }

  const medianLength = median(lengths);
  const variability = stdDev(lengths);
  const lastStart = periods[periods.length - 1]!.start;
  const predicted = addDays(lastStart, medianLength);

  if (variability > VARIABILITY_THRESHOLD_DAYS) {
    const spread = Math.round(variability);
    return {
      rangeStart: addDays(predicted, -spread),
      rangeEnd: addDays(predicted, spread),
      confidence: 'wide',
    };
  }

  return { date: predicted, confidence: 'confirmed' };
}

/**
 * Luteal phase (ovulation to next period) is far more consistent across
 * cycles than the follicular phase — the standard heuristic every period
 * tracker uses.
 */
export function estimateFertileWindow(nextPeriodDate: string): FertileWindow {
  const peak = addDays(nextPeriodDate, -LUTEAL_PHASE_DAYS);
  return {
    start: addDays(peak, -FERTILE_WINDOW_BEFORE_OVULATION_DAYS),
    end: addDays(peak, FERTILE_WINDOW_AFTER_OVULATION_DAYS),
    peak,
  };
}
