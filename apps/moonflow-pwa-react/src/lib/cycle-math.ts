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

import { PERIOD_FLOW_LEVELS, PERIOD_GAP_TOLERANCE_DAYS } from './constants';
import type { Entry, Period } from './types';

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



// --- Period detection (prediction lives in forecast.ts) ---

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
