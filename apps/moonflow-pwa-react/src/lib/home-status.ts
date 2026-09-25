// src/lib/home-status.ts — everything Home needs to display, derived from
// the shared forecast (forecast.ts). Kept separate from the Home component so
// it's independently unit-tested.
import { diffDays, formatDate, parseDate } from './cycle-math';
import { computeForecast } from './forecast';
import type { Entry, Settings } from './types';

/** 'unknown' is a real state, not a loading placeholder: no start date yet, or
 * a late period — no cycle-phase signal to show honestly beats guessing one. */
export type CyclePhase = 'period' | 'follicular' | 'fertile' | 'luteal' | 'unknown';

/** Degrees, 0-360, 0 = the top of the ring = day 1 of the cycle (clock-face
 * convention; the rendering side applies SVG's -90° rotation). One full lap =
 * one predicted cycle. */
export interface CycleRing {
  totalDays: number;
  todayAngle: number;
  /** The period arc always starts at angle 0 (cycle day 1). */
  periodEndAngle: number;
  fertileStartAngle: number;
  fertileEndAngle: number;
}

export interface HomeStatus {
  cycleDay: number | null;
  /** The single number/short phrase Home renders big and bold. */
  headline: string;
  /** The small caption under `headline` explaining what it means. */
  caption: string;
  /** Secondary line: the expected range, always shown when there's a prediction. */
  detail: string | null;
  isEstimated: boolean;
  /** Why the prediction is only an estimate — shown behind the "estimated" tap target. */
  estimateNote: string | null;
  isLate: boolean;
  cyclePhase: CyclePhase;
  ring: CycleRing | null;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function shortDate(dateStr: string): string {
  return parseDate(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** "22–26 Aug" within a month, "20 Jun–3 Jul" across months. */
export function formatDateRange(start: string, end: string): string {
  const s = parseDate(start);
  const e = parseDate(end);
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()}–${shortDate(end)}`;
  }
  return `${shortDate(start)}–${shortDate(end)}`;
}

export function computeHomeStatus(
  entries: Array<Pick<Entry, 'date' | 'flow'>>,
  settings: Pick<Settings, 'avgCycleLength' | 'avgPeriodLength' | 'lastPeriodStart'>,
  today: Date = new Date(),
): HomeStatus {
  const todayStr = formatDate(today);
  const f = computeForecast(entries, settings, today);

  if (f.status === 'none' || !f.next || !f.lastStart) {
    return {
      cycleDay: null,
      headline: 'Welcome',
      caption: 'log your period to start predictions',
      detail: null,
      isEstimated: false,
      estimateNote: null,
      isLate: false,
      cyclePhase: 'unknown',
      ring: null,
    };
  }

  const next = f.next;
  const daysToNext = diffDays(todayStr, next.date);
  const inFertile = !!f.fertile && diffDays(f.fertile.start, todayStr) >= 0 && diffDays(todayStr, f.fertile.end) >= 0;

  let headline: string;
  let caption: string;
  let cyclePhase: CyclePhase;
  switch (f.status) {
    case 'on-period':
      headline = `Day ${f.cycleDay}`;
      caption = 'of your period';
      cyclePhase = 'period';
      break;
    case 'late':
      headline = `${plural(f.daysLate, 'day')} late`;
      caption = 'log your period when it starts';
      cyclePhase = 'unknown';
      break;
    case 'due':
      if (daysToNext > 0) {
        headline = plural(daysToNext, 'day');
        caption = 'your period could start any day';
      } else if (daysToNext === 0) {
        headline = 'Today';
        caption = 'your period may start today';
      } else {
        headline = 'Any day now';
        caption = 'your period is due';
      }
      cyclePhase = 'luteal';
      break;
    default:
      if (inFertile && f.fertile) {
        const daysLeft = diffDays(todayStr, f.fertile.end);
        headline = daysLeft <= 0 ? 'Last day' : `${plural(daysLeft, 'day')} left`;
        caption = 'in your estimated fertile window';
        cyclePhase = 'fertile';
      } else {
        headline = plural(daysToNext, 'day');
        caption = 'to your next period';
        cyclePhase = f.fertile && diffDays(todayStr, f.fertile.start) > 0 ? 'follicular' : 'luteal';
      }
  }

  const isEstimated = f.status !== 'on-period' && next.confidence === 'estimated';
  let estimateNote: string | null = null;
  if (isEstimated) {
    if (f.usedCycleLengths.length === 1) {
      estimateNote = 'Based on only one logged cycle so far — log your next period and this becomes a confirmed prediction.';
    } else if (f.latestPeriod) {
      estimateNote = 'Based on your logged period and your average cycle length — log a couple more cycles and this sharpens into a confirmed prediction.';
    } else {
      estimateNote = 'Based on the date you entered during setup, not real tracking yet — log a couple of real cycles and this sharpens into a confirmed prediction.';
    }
  }

  const detail =
    f.status === 'on-period' || f.status === 'late'
      ? null
      : `Expected ${formatDateRange(next.rangeStart, next.rangeEnd)}${f.irregular ? ' · cycles vary' : ''}`;

  let ring: CycleRing | null = null;
  const totalDays = diffDays(f.lastStart, next.date);
  if (totalDays > 0) {
    const angleFor = (dateStr: string) => (Math.min(Math.max(diffDays(f.lastStart!, dateStr), 0), totalDays) / totalDays) * 360;
    const periodDays =
      f.latestPeriod && f.latestPeriod.start === f.lastStart ? diffDays(f.latestPeriod.start, f.latestPeriod.end) + 1 : f.periodLength;
    ring = {
      totalDays,
      todayAngle: angleFor(todayStr),
      periodEndAngle: Math.min(360, (periodDays / totalDays) * 360),
      fertileStartAngle: f.fertile ? angleFor(f.fertile.start) : 0,
      fertileEndAngle: f.fertile ? angleFor(f.fertile.end) : 0,
    };
  }

  return {
    cycleDay: f.cycleDay,
    headline,
    caption,
    detail,
    isEstimated,
    estimateNote,
    isLate: f.status === 'late',
    cyclePhase,
    ring,
  };
}
