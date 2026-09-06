// src/lib/home-status.ts — everything Home needs to display, computed from
// raw entries + settings. Ported from home.js's computeHomeStatus. Kept
// separate from the Home screen component so it's independently unit-tested,
// same split cycle-math.ts itself draws.
import { derivePeriods, diffDays, estimateFertileWindow, formatDate, predictNextPeriod } from './cycle-math';
import { getMoonPhase } from './moon-phase';
import type { Entry, Settings } from './types';

/**
 * Ambient sky/weather mood signal (sky-mood.ts/sun-mood.ts/weather-mood.ts,
 * rendered by WorldScene) — deliberately separate from `moonPhase` (real
 * astronomy, ADR-019) and from cycle-moon-phase.ts's cycle-synced moon
 * phase (ADR-036) — three independent signals, not one. 'unknown' is a
 * real state, not a loading placeholder: shown whenever prediction
 * confidence is 'wide', same case that already yields
 * "predictions need a bit more history" — no cycle-phase signal to show
 * honestly beats guessing one.
 */
export type CyclePhase = 'period' | 'follicular' | 'fertile' | 'luteal' | 'unknown';

export interface HomeStatus {
  cycleDay: number | null;
  statusText: string;
  isFertile: boolean;
  isEstimated: boolean;
  moonPhase: number;
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
  let isFertile = false;
  let cyclePhase: CyclePhase;

  if (isOnPeriod) {
    statusText = 'on your period';
    cyclePhase = 'period';
  } else if (prediction.confidence !== 'wide' && prediction.date) {
    const fertile = estimateFertileWindow(prediction.date);
    isFertile = diffDays(fertile.start, todayStr) >= 0 && diffDays(todayStr, fertile.end) >= 0;
    const daysToNext = diffDays(todayStr, prediction.date);
    statusText = isFertile
      ? 'fertile window'
      : daysToNext >= 0
        ? `${daysToNext} day${daysToNext === 1 ? '' : 's'} to next period`
        : 'period may be starting soon';
    cyclePhase = isFertile ? 'fertile' : diffDays(todayStr, fertile.start) > 0 ? 'follicular' : 'luteal';
  } else {
    statusText = 'predictions need a bit more history';
    cyclePhase = 'unknown';
  }

  return {
    cycleDay,
    statusText,
    isFertile,
    isEstimated: prediction.confidence === 'estimated',
    moonPhase: getMoonPhase(today),
    cyclePhase,
  };
}
