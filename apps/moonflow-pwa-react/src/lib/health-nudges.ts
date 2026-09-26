// src/lib/health-nudges.ts — T64. Gentle, pattern-based prompts to talk to a
// clinician, using FIGO 2018 criteria for abnormal uterine bleeding (Munro et
// al., Int J Gynecol Obstet 2018): normal frequency 24–38 days, regularity
// spread ≤7 days, duration ≤8 days, no intermenstrual bleeding; plus ≥90 days
// without a period (secondary amenorrhoea). Never alarming, never a
// diagnosis — and only for patterns that persist, not a single odd cycle.
import { derivePeriods, diffDays, formatDate } from './cycle-math';
import { computeForecast } from './forecast';
import type { Entry, Settings } from './types';

export type NudgeId = 'cycle-length' | 'irregular' | 'long-period' | 'intermenstrual' | 'no-period-90';

export interface HealthNudge {
  id: NudgeId;
  title: string;
  body: string;
}

const RECENT = 6;
const CAVEAT = "This is not a diagnosis — cycles vary, and a clinician can tell you whether it's worth looking into.";

export function healthNudges(
  entries: Array<Pick<Entry, 'date' | 'flow'>>,
  settings: Pick<Settings, 'lastPeriodStart' | 'avgCycleLength' | 'avgPeriodLength'> & { predictionsPaused?: boolean },
  today: Date = new Date(),
): HealthNudge[] {
  if (settings.predictionsPaused) return [];
  const todayStr = formatDate(today);
  const forecast = computeForecast(entries, settings, today);
  const periods = derivePeriods(entries);
  const cycles = forecast.cycleLengths.slice(-RECENT);
  const nudges: HealthNudge[] = [];

  const outOfRange = cycles.filter((n) => n < 24 || n > 38).length;
  if (outOfRange >= 2) {
    nudges.push({
      id: 'cycle-length',
      title: 'Your cycles are often shorter or longer than usual',
      body: `${outOfRange} of your last ${cycles.length} cycles were outside the typical 24–38 days. ${CAVEAT}`,
    });
  }

  const used = forecast.usedCycleLengths;
  if (used.length >= 3 && Math.max(...used) - Math.min(...used) >= 8) {
    nudges.push({
      id: 'irregular',
      title: 'Your cycle length varies quite a bit',
      body: `Your recent cycles ranged from ${Math.min(...used)} to ${Math.max(...used)} days. ${CAVEAT}`,
    });
  }

  const longest = Math.max(0, ...periods.slice(-RECENT).map((p) => diffDays(p.start, p.end) + 1));
  if (longest > 8) {
    nudges.push({
      id: 'long-period',
      title: 'One of your recent periods lasted a while',
      body: `A period of ${longest} days is longer than the usual 8 or fewer. ${CAVEAT}`,
    });
  }

  // Bleeding (spotting counts) on a day outside any detected period, in two
  // or more different cycles.
  const starts = periods.map((p) => p.start);
  const inPeriod = (d: string) => periods.some((p) => diffDays(p.start, d) >= -2 && diffDays(d, p.end) >= 0);
  const cyclesWithBleeding = new Set(
    entries
      .filter((e) => (e.flow === 'spotting' || e.flow === 'light') && !inPeriod(e.date))
      .map((e) => starts.filter((s) => s <= e.date).at(-1) ?? 'before-first'),
  );
  if (cyclesWithBleeding.size >= 2) {
    nudges.push({
      id: 'intermenstrual',
      title: "You've logged bleeding between periods",
      body: `Spotting or bleeding outside your period showed up in ${cyclesWithBleeding.size} cycles. ${CAVEAT}`,
    });
  }

  if (forecast.lastStart && diffDays(forecast.lastStart, todayStr) >= 90) {
    nudges.push({
      id: 'no-period-90',
      title: "It's been a while since your last period",
      body: `Your last logged period started ${diffDays(forecast.lastStart, todayStr)} days ago. If you might have missed logging one, add it on the Calendar. ${CAVEAT}`,
    });
  }

  return nudges;
}

/** Static, not detected: when heavy bleeding needs care now (ACOG). */
export const HEAVY_BLEEDING_ADVICE =
  'Get urgent care if you soak through a pad or tampon every hour for more than two hours, or feel dizzy, faint, or short of breath.';
