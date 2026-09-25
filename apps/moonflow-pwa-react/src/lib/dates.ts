// src/lib/dates.ts — date-string validation shared by routing and import.
import { formatDate, parseDate, todayString } from './cycle-math';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" that names a real calendar day — `2026-02-30` passes a regex
 * but rolls over to March inside Date, so round-trip it to be sure. */
export function isRealDate(value: unknown): value is string {
  return typeof value === 'string' && DATE_RE.test(value) && formatDate(parseDate(value)) === value;
}

export function isFutureDate(dateStr: string, today: string = todayString()): boolean {
  return dateStr > today;
}
