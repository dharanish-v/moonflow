// src/lib/cycle-moon-phase.ts — ADR-036. Cycle-synced moon phase, a system
// deliberately SEPARATE from moon-phase.ts's real astronomy (untouched by
// this file, ADR-019 stays intact) and from sky-mood.ts's 5-state
// SKY_MOODS table (also untouched — this is a third, independent signal).
// Pure math, no React/Three imports, same testing split every other lib
// module here already draws.
//
// Mapping: day 1 of the most recent period = new moon (phase 0); the
// predicted next-period date's own median cycle length places ovulation at
// `effectiveCycleLength - LUTEAL_PHASE_DAYS` = full moon (phase 0.5);
// piecewise-linear between, wrapping back down after. Reuses
// predictNextPeriod's own median cycle length — the same number already
// driving "N days to next period" elsewhere — rather than an independently
// computed average, so this can never silently disagree with the rest of
// the app, and self-corrects as real cycle length drifts over time.
//
// Returns null when there isn't enough real history to place a phase yet
// (prediction confidence 'wide', or no period data at all) — the caller
// falls back to real astronomy (getMoonPhase) for that case, same fallback
// already used for the privacy gate (AppGate.tsx) pre-unlock.
import { LUTEAL_PHASE_DAYS } from './constants';
import { derivePeriods, diffDays, formatDate, predictNextPeriod } from './cycle-math';
import type { Entry, Settings } from './types';

export function computeCycleMoonPhase(
  entries: Array<Pick<Entry, 'date' | 'flow'>>,
  settings: Pick<Settings, 'avgCycleLength' | 'lastPeriodStart'>,
  today: Date = new Date(),
): number | null {
  const todayStr = formatDate(today);
  const periods = derivePeriods(entries);
  const mostRecent = periods.length > 0 ? periods[periods.length - 1] : null;
  const mostRecentStart = mostRecent ? mostRecent.start : settings.lastPeriodStart;
  if (!mostRecentStart) return null;

  const prediction = predictNextPeriod(periods, settings);
  if (prediction.confidence === 'wide' || !prediction.date) return null;

  const effectiveCycleLength = diffDays(mostRecentStart, prediction.date);
  if (effectiveCycleLength < 3) return null; // too short to place a meaningful phase

  const ovulationDay = Math.min(effectiveCycleLength - 1, Math.max(2, effectiveCycleLength - LUTEAL_PHASE_DAYS));

  const rawCycleDay = diffDays(mostRecentStart, todayStr) + 1;
  // Wrap into [1, effectiveCycleLength] so an overrunning/late period
  // doesn't push cycleDay out of the function's domain.
  const cycleDay = (((rawCycleDay - 1) % effectiveCycleLength) + effectiveCycleLength) % effectiveCycleLength + 1;

  if (cycleDay <= ovulationDay) {
    return (0.5 * (cycleDay - 1)) / (ovulationDay - 1);
  }
  return 0.5 + (0.5 * (cycleDay - ovulationDay)) / (effectiveCycleLength - ovulationDay);
}
