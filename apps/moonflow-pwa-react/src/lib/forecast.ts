// src/lib/forecast.ts — prediction engine v2 (T42). The single source of
// truth Home, Calendar and Insights all read, so they can never disagree
// about what's predicted (they used to: Home showed an estimated fertile
// window Calendar refused to draw).
//
// Grounded in the cycle literature, not just the old "median of everything":
// - Only cycles of 15–90 days count; two logs a few days apart are not a cycle.
// - A cycle ≥1.6× the median is most likely a period that was never logged
//   (Li et al., JAMIA 2022) — excluded from prediction, surfaced to the UI.
// - Prediction uses the most recent 6 valid cycles, so life changes (stopping
//   the pill, postpartum, age) aren't drowned out by old history.
// - "Confirmed" needs ≥2 valid cycles; one cycle has zero spread by definition.
// - Always a range, never false precision; irregular = spread ≥8 days (FIGO).
// - Past the range is "late", with a day count — never "any day now" forever.
// - Ovulation ~13 days before the period (mean luteal phase 12.4 days, Bull
//   et al. 2019), fertile window widened by the prediction range.

import { addDays, derivePeriods, diffDays, formatDate } from './cycle-math';
import { MAX_PERIOD_LENGTH, MIN_PERIOD_LENGTH, PERIOD_GAP_TOLERANCE_DAYS } from './constants';
import type { Entry, Period, Settings } from './types';

export const MIN_VALID_CYCLE_DAYS = 15;
export const MAX_VALID_CYCLE_DAYS = 90;
export const MISSED_LOG_FACTOR = 1.6;
export const PREDICTION_WINDOW_CYCLES = 6;
export const IRREGULAR_SPREAD_DAYS = 8;
export const OVULATION_BEFORE_PERIOD_DAYS = 13;
const FERTILE_BEFORE_OVULATION_DAYS = 5;
const FERTILE_AFTER_OVULATION_DAYS = 1;
/** Minimum half-width of any predicted range. */
const MIN_RANGE_HALF_DAYS = 2;
/** Estimates (no confirmed history) get a wider honest range. */
const ESTIMATE_RANGE_HALF_DAYS = 3;
/** The onboarding date only counts as its own cycle start if it isn't just
 * the start of a period the user also went on to log. */
const ANCHOR_MERGE_DAYS = 7;

export type ForecastStatus = 'none' | 'paused' | 'on-period' | 'upcoming' | 'due' | 'late';

export interface NextPeriod {
  date: string;
  rangeStart: string;
  rangeEnd: string;
  confidence: 'estimated' | 'confirmed';
}

export interface FertileWindow {
  start: string;
  end: string;
  peak: string;
}

export interface Forecast {
  status: ForecastStatus;
  /** Start of the current cycle (latest period start, or the onboarding date). */
  lastStart: string | null;
  /** The latest logged period, if any. */
  latestPeriod: Period | null;
  cycleDay: number | null;
  next: NextPeriod | null;
  /** Days past the predicted date; 0 unless status is 'late'. */
  daysLate: number;
  fertile: FertileWindow | null;
  /** Predicted length of the next period, in days. */
  periodLength: number;
  /** Every valid (15–90 day) cycle length, oldest first. */
  cycleLengths: number[];
  /** The cycles the prediction actually used (recent window, missed logs removed). */
  usedCycleLengths: number[];
  suspectedMissedCycles: Array<{ start: string; length: number }>;
  irregular: boolean;
}

function median(numbers: number[]): number {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Period starts, plus the onboarding date when it's a distinct earlier start. */
function cycleStarts(periods: Period[], lastPeriodStart: string | null): string[] {
  const starts = periods.map((p) => p.start);
  if (lastPeriodStart && starts.every((s) => Math.abs(diffDays(lastPeriodStart, s)) > ANCHOR_MERGE_DAYS)) {
    starts.push(lastPeriodStart);
  }
  return [...new Set(starts)].sort();
}

export function computeForecast(
  entries: Array<Pick<Entry, 'date' | 'flow'>>,
  settings: Pick<Settings, 'lastPeriodStart' | 'avgCycleLength' | 'avgPeriodLength'> & {
    predictionsPaused?: boolean;
    confirmedLongCycles?: string[];
  },
  today: Date = new Date(),
): Forecast {
  const todayStr = formatDate(today);
  const periods = derivePeriods(entries);
  const latestPeriod = periods.at(-1) ?? null;
  const starts = cycleStarts(periods, settings.lastPeriodStart);

  // Only finished periods say how long a period lasts: one that ended within
  // the missed-log tolerance may still be going (day 1 is not a 1-day period).
  const completedPeriods = periods.filter((p) => diffDays(p.end, todayStr) > PERIOD_GAP_TOLERANCE_DAYS);
  const recentPeriodLengths = completedPeriods.slice(-PREDICTION_WINDOW_CYCLES).map((p) => diffDays(p.start, p.end) + 1);
  const periodLength = recentPeriodLengths.length
    ? clamp(Math.round(median(recentPeriodLengths)), MIN_PERIOD_LENGTH, MAX_PERIOD_LENGTH)
    : settings.avgPeriodLength;

  const empty: Forecast = {
    status: 'none',
    lastStart: null,
    latestPeriod,
    cycleDay: null,
    next: null,
    daysLate: 0,
    fertile: null,
    periodLength,
    cycleLengths: [],
    usedCycleLengths: [],
    suspectedMissedCycles: [],
    irregular: false,
  };
  if (starts.length === 0) return empty;

  // Cycles between consecutive starts; impossible ones (too short/long) dropped.
  const cycles: Array<{ start: string; length: number }> = [];
  for (let i = 1; i < starts.length; i++) {
    const length = diffDays(starts[i - 1]!, starts[i]!);
    if (length >= MIN_VALID_CYCLE_DAYS && length <= MAX_VALID_CYCLE_DAYS) cycles.push({ start: starts[i - 1]!, length });
  }

  const baseline = cycles.length ? median(cycles.map((c) => c.length)) : 0;
  // A long cycle the user confirmed was real counts like any other.
  const confirmed = settings.confirmedLongCycles ?? [];
  const suspectedMissedCycles =
    cycles.length >= 3 ? cycles.filter((c) => c.length >= baseline * MISSED_LOG_FACTOR && !confirmed.includes(c.start)) : [];
  const usedCycleLengths = cycles
    .filter((c) => !suspectedMissedCycles.includes(c))
    .slice(-PREDICTION_WINDOW_CYCLES)
    .map((c) => c.length);

  const lastStart = starts.at(-1)!;
  let next: NextPeriod;
  let irregular = false;
  if (usedCycleLengths.length >= 2) {
    const typical = Math.round(median(usedCycleLengths));
    const shortest = Math.min(...usedCycleLengths);
    const longest = Math.max(...usedCycleLengths);
    irregular = longest - shortest >= IRREGULAR_SPREAD_DAYS;
    next = {
      date: addDays(lastStart, typical),
      rangeStart: addDays(lastStart, Math.min(shortest, typical - MIN_RANGE_HALF_DAYS)),
      rangeEnd: addDays(lastStart, Math.max(longest, typical + MIN_RANGE_HALF_DAYS)),
      confidence: 'confirmed',
    };
  } else {
    const typical = usedCycleLengths.length === 1 ? usedCycleLengths[0]! : settings.avgCycleLength;
    next = {
      date: addDays(lastStart, typical),
      rangeStart: addDays(lastStart, typical - ESTIMATE_RANGE_HALF_DAYS),
      rangeEnd: addDays(lastStart, typical + ESTIMATE_RANGE_HALF_DAYS),
      confidence: 'estimated',
    };
  }

  const onPeriod =
    !!latestPeriod && latestPeriod.start === lastStart && diffDays(latestPeriod.start, todayStr) >= 0 && diffDays(todayStr, latestPeriod.end) >= 0;

  let status: ForecastStatus;
  if (onPeriod) status = 'on-period';
  else if (diffDays(todayStr, next.rangeStart) > 0) status = 'upcoming';
  else if (diffDays(todayStr, next.rangeEnd) >= 0) status = 'due';
  else status = 'late';

  const peak = addDays(next.date, -OVULATION_BEFORE_PERIOD_DAYS);
  const fertile: FertileWindow | null =
    status !== 'late'
      ? {
          start: addDays(next.rangeStart, -OVULATION_BEFORE_PERIOD_DAYS - FERTILE_BEFORE_OVULATION_DAYS),
          end: addDays(next.rangeEnd, -OVULATION_BEFORE_PERIOD_DAYS + FERTILE_AFTER_OVULATION_DAYS),
          peak,
        }
      : null;

  if (settings.predictionsPaused) {
    return {
      ...empty,
      status: 'paused',
      lastStart,
      cycleDay: diffDays(lastStart, todayStr) + 1,
      cycleLengths: cycles.map((c) => c.length),
      usedCycleLengths,
      suspectedMissedCycles,
    };
  }

  return {
    status,
    lastStart,
    latestPeriod,
    cycleDay: diffDays(lastStart, todayStr) + 1,
    next,
    daysLate: status === 'late' ? diffDays(next.date, todayStr) : 0,
    fertile,
    periodLength,
    cycleLengths: cycles.map((c) => c.length),
    usedCycleLengths,
    suspectedMissedCycles,
    irregular,
  };
}

export interface MissedPeriodPrompt {
  /** Start of the suspiciously long cycle — also the id used to dismiss it. */
  cycleStart: string;
  /** Where the unlogged period most likely was: halfway through. */
  likelyDate: string;
}

/** Long cycles that probably hide an unlogged period, minus the ones the
 * user has already confirmed were real (T78). */
export function missedPeriodPrompts(
  entries: Array<Pick<Entry, 'date' | 'flow'>>,
  settings: Pick<Settings, 'lastPeriodStart' | 'avgCycleLength' | 'avgPeriodLength'>,
  confirmedLongCycles: string[],
  today: Date = new Date(),
): MissedPeriodPrompt[] {
  return computeForecast(entries, settings, today)
    .suspectedMissedCycles.filter((c) => !confirmedLongCycles.includes(c.start))
    .map((c) => ({ cycleStart: c.start, likelyDate: addDays(c.start, Math.round(c.length / 2)) }));
}
