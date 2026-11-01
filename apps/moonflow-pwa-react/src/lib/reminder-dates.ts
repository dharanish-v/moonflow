// src/lib/reminder-dates.ts — the predicted period starts reminders are for,
// shared by the .ics export (T67) and push reminders (T103, ADR-055).
import { computeForecast } from './forecast';
import { upcomingPeriods } from './ics';
import type { Entry, Settings } from './types';

export const REMINDER_COUNT = 6;

/** The next predicted starts, or [] when there's nothing honest to predict
 * (paused, late, or not enough data). */
export function predictedStarts(entries: Entry[], settings: Settings, count = REMINDER_COUNT): string[] {
  const forecast = computeForecast(entries, settings);
  const next = forecast.status === 'late' || !forecast.next ? null : forecast.next.date;
  if (!next) return [];
  const used = forecast.usedCycleLengths;
  const typical = used.length ? Math.round([...used].sort((a, b) => a - b)[Math.floor(used.length / 2)]!) : settings.avgCycleLength;
  return upcomingPeriods(next, typical, count);
}

/** 9:00 local time the day before each start, as Unix seconds, future only. */
export function reminderTimes(starts: string[], nowMs: number): number[] {
  return starts
    .map((d) => {
      const [y, m, day] = d.split('-').map(Number) as [number, number, number];
      return Math.floor(new Date(y, m - 1, day - 1, 9, 0, 0).getTime() / 1000);
    })
    .filter((t) => t * 1000 > nowMs);
}
