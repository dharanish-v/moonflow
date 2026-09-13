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
}

export function computeHomeStatus(
  entries: Array<Pick<Entry, 'date' | 'flow'>>,
  settings: Pick<Settings, 'avgCycleLength' | 'lastPeriodStart'>,
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
  } else if (prediction.confidence !== 'wide' && prediction.date) {
    const fertile = estimateFertileWindow(prediction.date);
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
      statusText = `${daysToNext} day${daysToNext === 1 ? '' : 's'} to next period`;
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

  return {
    cycleDay,
    statusText,
    headline,
    caption,
    isFertile,
    isEstimated: !isOnPeriod && prediction.confidence === 'estimated',
    cyclePhase,
  };
}
