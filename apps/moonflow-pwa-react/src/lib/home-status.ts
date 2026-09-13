// src/lib/home-status.ts — everything Home needs to display, computed from
// raw entries + settings. Ported from home.js's computeHomeStatus. Kept
// separate from the Home screen component so it's independently unit-tested,
// same split cycle-math.ts itself draws.
import { derivePeriods, diffDays, estimateFertileWindow, formatDate, predictNextPeriod } from './cycle-math';
import type { Entry, Settings } from './types';

/**
 * 'unknown' is a real state, not a loading placeholder: shown whenever
 * prediction confidence is 'wide', same case that already yields
 * "predictions need a bit more history" — no cycle-phase signal to show
 * honestly beats guessing one.
 */
export type CyclePhase = 'period' | 'follicular' | 'fertile' | 'luteal' | 'unknown';

/** Degrees, 0-360, 0 = the top of the ring = day 1 of the cycle (matches a
 * clock-face convention, not SVG's own 3-o'clock zero — the rendering side
 * applies the -90° rotation). One full lap = one predicted cycle, the same
 * "one loop" convention Flo's own dial uses. */
export interface CycleRing {
  totalDays: number;
  todayAngle: number;
  /** The period arc always starts at angle 0 (cycle day 1), so only its end
   * angle is needed. */
  periodEndAngle: number;
  fertileStartAngle: number;
  fertileEndAngle: number;
}

export interface HomeStatus {
  cycleDay: number | null;
  statusText: string;
  /** The single number/short phrase Home renders big and bold — a
   * countdown-first reframe (days to next period / days left fertile /
   * cycle day / "Welcome"), not the cycle-day count `statusText` leads with.
   * Mirrors how Flo's own home screen leads with "days left," not "day X." */
  headline: string;
  /** The small caption under `headline` explaining what it means. */
  caption: string;
  isFertile: boolean;
  isEstimated: boolean;
  cyclePhase: CyclePhase;
  /** null whenever there's no confident predicted date to size a lap of the
   * ring against — same 'wide'-confidence gate the headline/caption already
   * use, not Calendar's stricter confirmed-only gate for its dots (Home's
   * own estimated-countdown convention already predates this). */
  ring: CycleRing | null;
}

export function computeHomeStatus(
  entries: Array<Pick<Entry, 'date' | 'flow'>>,
  settings: Pick<Settings, 'avgCycleLength' | 'avgPeriodLength' | 'lastPeriodStart'>,
  today: Date = new Date(),
): HomeStatus {
  const todayStr = formatDate(today);
  const periods = derivePeriods(entries);
  const mostRecent = periods.length > 0 ? periods[periods.length - 1] : null;
  const mostRecentStart = mostRecent ? mostRecent.start : settings.lastPeriodStart;
  const mostRecentEnd = mostRecent ? mostRecent.end : null;

  const cycleDay = mostRecentStart ? diffDays(mostRecentStart, todayStr) + 1 : null;
  const prediction = predictNextPeriod(periods, settings);
  const isOnPeriod = !!(
    mostRecentEnd &&
    mostRecentStart &&
    diffDays(mostRecentStart, todayStr) >= 0 &&
    diffDays(todayStr, mostRecentEnd) >= 0
  );

  // Computed once regardless of which headline branch fires below, since
  // the ring needs the fertile window even while on-period (isFertile the
  // *status flag* still respects on-period priority, same as before this
  // was hoisted out of the else-if).
  const fertile = prediction.confidence !== 'wide' && prediction.date ? estimateFertileWindow(prediction.date) : null;

  let statusText: string;
  let headline: string;
  let caption: string;
  let isFertile = false;
  let cyclePhase: CyclePhase;

  if (isOnPeriod) {
    statusText = 'on your period';
    headline = `Day ${cycleDay}`;
    caption = 'of your period';
    cyclePhase = 'period';
  } else if (fertile && prediction.date) {
    isFertile = diffDays(fertile.start, todayStr) >= 0 && diffDays(todayStr, fertile.end) >= 0;
    const daysToNext = diffDays(todayStr, prediction.date);
    if (isFertile) {
      statusText = 'fertile window';
      const daysLeft = diffDays(todayStr, fertile.end);
      headline = daysLeft <= 0 ? 'Last day' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;
      caption = 'in your fertile window';
    } else if (daysToNext > 0) {
      statusText = `${daysToNext} day${daysToNext === 1 ? '' : 's'} to next period`;
      headline = `${daysToNext} day${daysToNext === 1 ? '' : 's'}`;
      caption = 'to your next period';
    } else if (daysToNext === 0) {
      statusText = '0 days to next period';
      headline = 'Today';
      caption = 'your period may start today';
    } else {
      statusText = 'period may be starting soon';
      headline = 'Any day now';
      caption = 'your period may be starting soon';
    }
    cyclePhase = isFertile ? 'fertile' : diffDays(todayStr, fertile.start) > 0 ? 'follicular' : 'luteal';
  } else {
    statusText = 'predictions need a bit more history';
    // A genuinely new user (no history at all) sees "Welcome," not "Day
    // null" — but someone with real logged periods whose cycle is just too
    // irregular for a confident prediction still has a real cycle day to
    // show, same as the old dayLabel fallback this replaces.
    headline = cycleDay !== null ? `Day ${cycleDay}` : 'Welcome';
    caption = statusText;
    cyclePhase = 'unknown';
  }

  let ring: CycleRing | null = null;
  if (mostRecentStart && prediction.date) {
    const totalDays = diffDays(mostRecentStart, prediction.date);
    if (totalDays > 0) {
      const angleFor = (dateStr: string) => {
        const wrapped = ((diffDays(mostRecentStart, dateStr) % totalDays) + totalDays) % totalDays;
        return (wrapped / totalDays) * 360;
      };
      const periodLengthDays = mostRecent ? diffDays(mostRecent.start, mostRecent.end) + 1 : settings.avgPeriodLength;
      ring = {
        totalDays,
        todayAngle: angleFor(todayStr),
        periodEndAngle: Math.min(360, (periodLengthDays / totalDays) * 360),
        fertileStartAngle: fertile ? angleFor(fertile.start) : 0,
        fertileEndAngle: fertile ? angleFor(fertile.end) : 0,
      };
    }
  }

  return {
    cycleDay,
    statusText,
    headline,
    caption,
    isFertile,
    isEstimated: !isOnPeriod && prediction.confidence === 'estimated',
    cyclePhase,
    ring,
  };
}
