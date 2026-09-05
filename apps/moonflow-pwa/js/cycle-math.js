// @ts-check
// cycle-math.js — see moonflow-technical-design.md for the algorithm pseudocode
// this implements, and cycle-math-tests.html for the contract it must satisfy.
//
// Note: no date-fns dependency here, despite earlier planning docs mentioning one.
// Date-only values (ADR-012) plus local-midnight construction and Math.round() on
// the day-count division are sufficient to be exactly DST-safe without a library —
// a single DST transition only ever contributes a ±1 hour (≤1/24 day) offset, which
// rounding always resolves back to the correct whole-day count.

import {
  PERIOD_FLOW_LEVELS,
  PERIOD_GAP_TOLERANCE_DAYS,
  VARIABILITY_THRESHOLD_DAYS,
  LUTEAL_PHASE_DAYS,
  FERTILE_WINDOW_BEFORE_OVULATION_DAYS,
  FERTILE_WINDOW_AFTER_OVULATION_DAYS
} from './constants.js';

// --- Local date-only helpers ---

/** @param {string} dateStr "YYYY-MM-DD" */
function parseDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d); // local midnight — deliberate, see note above
}

/** @param {Date} date */
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * @param {string} dateStr
 * @param {number} days
 */
export function addDays(dateStr, days) {
  const date = parseDate(dateStr);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

/**
 * Whole calendar days from `fromStr` to `toStr`. DST-safe (see file header note).
 * @param {string} fromStr
 * @param {string} toStr
 */
export function diffDays(fromStr, toStr) {
  const from = parseDate(fromStr);
  const to = parseDate(toStr);
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

/** @param {number[]} numbers */
function median(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** @param {number[]} numbers */
function stdDev(numbers) {
  const avg = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  const variance = numbers.reduce((sum, n) => sum + (n - avg) ** 2, 0) / numbers.length;
  return Math.sqrt(variance);
}

// --- Core algorithms ---

/**
 * Groups logged days into periods. None and Spotting are excluded from boundary
 * detection — only Light/Medium/Heavy count as real period days.
 * @param {Array<{date: string, flow: string|null}>} entries
 * @returns {Array<{start: string, end: string}>}
 */
export function derivePeriods(entries) {
  const periodDays = entries
    .filter(e => PERIOD_FLOW_LEVELS.includes(e.flow ?? ''))
    .map(e => e.date)
    .sort();

  /** @type {Array<{start: string, end: string}>} */
  const periods = [];
  /** @type {{start: string, end: string} | null} */
  let current = null;

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

/**
 * @param {Array<{start: string, end?: string}>} periods
 * @param {{avgCycleLength: number, lastPeriodStart?: string}} settings
 */
export function predictNextPeriod(periods, settings) {
  if (periods.length < 2) {
    const lastStart = periods.length === 1 ? periods[0].start : settings.lastPeriodStart;
    return {
      date: addDays(/** @type {string} */ (lastStart), settings.avgCycleLength),
      confidence: 'estimated'
    };
  }

  const lengths = [];
  for (let i = 1; i < periods.length; i++) {
    lengths.push(diffDays(periods[i - 1].start, periods[i].start));
  }

  const medianLength = median(lengths);
  const variability = stdDev(lengths);
  const lastStart = periods[periods.length - 1].start;
  const predicted = addDays(lastStart, medianLength);

  if (variability > VARIABILITY_THRESHOLD_DAYS) {
    const spread = Math.round(variability);
    return {
      rangeStart: addDays(predicted, -spread),
      rangeEnd: addDays(predicted, spread),
      confidence: 'wide'
    };
  }

  return { date: predicted, confidence: 'confirmed' };
}

/**
 * Luteal phase (ovulation to next period) is far more consistent across cycles
 * than the follicular phase — the standard heuristic every period tracker uses.
 * @param {string} nextPeriodDate
 */
export function estimateFertileWindow(nextPeriodDate) {
  const peak = addDays(nextPeriodDate, -LUTEAL_PHASE_DAYS);
  return {
    start: addDays(peak, -FERTILE_WINDOW_BEFORE_OVULATION_DAYS),
    end: addDays(peak, FERTILE_WINDOW_AFTER_OVULATION_DAYS),
    peak
  };
}
