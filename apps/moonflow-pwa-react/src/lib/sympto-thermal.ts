// src/lib/sympto-thermal.ts — T89. Retrospective ovulation confirmation from
// basal temperature + cervical mucus, following the published Sensiplan
// (NFP) rules also used by the open-source drip app:
//
//  Temperature: the first reading higher than each of the previous 6 valid
//  readings starts a candidate shift; the coverline is the highest of those
//  6. The shift is confirmed by 3 consecutive readings above the coverline,
//  the 3rd at least 0.2°C above it — or, if the 3rd falls short, a 4th
//  reading above the coverline (exception 1). Disturbed readings are skipped.
//
//  Mucus: the peak day is the last day of the best-quality mucus seen in the
//  cycle; it's confirmed once the following 3 days show lower quality.
//
//  Ovulation is "confirmed" only when both signs are complete, from the
//  later of the two days. This is a charting aid, reported after the fact —
//  it never labels days ahead as "safe".
import { addDays, derivePeriods, diffDays } from './cycle-math';
import type { Entry, MucusId } from './types';

const LOW_WINDOW = 6;
const SHIFT_MARGIN_C = 0.2;
const MUCUS_CONFIRM_DAYS = 3;
export const LUTEAL_MIN = 10;
export const LUTEAL_MAX = 16;

const MUCUS_RANK: Record<MucusId, number> = { dry: 0, sticky: 1, creamy: 2, watery: 3, eggwhite: 4 };

export interface CycleAnalysis {
  cycleStart: string;
  coverline: number | null;
  firstHigherDate: string | null;
  tempShiftDate: string | null;
  mucusPeakDate: string | null;
  mucusConfirmedDate: string | null;
  ovulationConfirmed: boolean;
  /** Best estimate of ovulation: the mucus peak, else the day before the first higher reading. */
  ovulationEstimate: string | null;
  /** From this day on, both signs agree ovulation has passed. */
  infertileFrom: string | null;
}

type Reading = { date: string; temp: number };

function temperatureShift(readings: Reading[]) {
  for (let i = LOW_WINDOW; i < readings.length; i++) {
    const coverline = Math.max(...readings.slice(i - LOW_WINDOW, i).map((r) => r.temp));
    if (readings[i]!.temp <= coverline) continue;
    const highs = readings.slice(i, i + 4);
    if (highs.length < 3 || !highs.slice(0, 3).every((r) => r.temp > coverline)) continue;
    if (highs[2]!.temp >= coverline + SHIFT_MARGIN_C - 1e-9) {
      return { coverline, firstHigherDate: readings[i]!.date, tempShiftDate: highs[2]!.date };
    }
    if (highs[3] && highs[3].temp > coverline) {
      return { coverline, firstHigherDate: readings[i]!.date, tempShiftDate: highs[3].date };
    }
  }
  return null;
}

function mucusPeak(cycleEntries: Array<Pick<Entry, 'date' | 'mucus'>>, lastDate: string) {
  const withMucus = cycleEntries.filter((e) => e.mucus);
  if (!withMucus.length) return null;
  const best = Math.max(...withMucus.map((e) => MUCUS_RANK[e.mucus!]));
  if (best < MUCUS_RANK.creamy) return null; // no fertile-quality mucus seen
  const peak = withMucus.filter((e) => MUCUS_RANK[e.mucus!] === best).at(-1)!.date;
  const confirmDate = addDays(peak, MUCUS_CONFIRM_DAYS);
  const afterPeak = cycleEntries.filter((e) => e.date > peak && e.date <= confirmDate);
  const stillPeak = afterPeak.some((e) => e.mucus && MUCUS_RANK[e.mucus] >= best);
  const confirmed = !stillPeak && diffDays(confirmDate, lastDate) >= 0;
  return { peak, confirmed: confirmed ? confirmDate : null };
}

/** Analyse one cycle: entries from `cycleStart` up to (not including) the next period start. */
export function analyzeCycle(entries: Entry[], cycleStart: string, nextStart?: string | null): CycleAnalysis {
  const inCycle = entries
    .filter((e) => e.date >= cycleStart && (!nextStart || e.date < nextStart))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const readings: Reading[] = inCycle
    .filter((e) => typeof e.temperature === 'number' && !e.tempDisturbed)
    .map((e) => ({ date: e.date, temp: e.temperature! }));
  const lastDate = inCycle.at(-1)?.date ?? cycleStart;

  const shift = temperatureShift(readings);
  const mucus = mucusPeak(inCycle, lastDate);
  const ovulationConfirmed = !!shift && !!mucus?.confirmed;
  const infertileFrom = ovulationConfirmed ? [shift!.tempShiftDate, mucus!.confirmed!].sort().at(-1)! : null;
  const ovulationEstimate = mucus?.peak ?? (shift ? addDays(shift.firstHigherDate, -1) : null);

  return {
    cycleStart,
    coverline: shift?.coverline ?? null,
    firstHigherDate: shift?.firstHigherDate ?? null,
    tempShiftDate: shift?.tempShiftDate ?? null,
    mucusPeakDate: mucus?.peak ?? null,
    mucusConfirmedDate: mucus?.confirmed ?? null,
    ovulationConfirmed,
    ovulationEstimate: ovulationConfirmed ? ovulationEstimate : shift || mucus ? ovulationEstimate : null,
    infertileFrom,
  };
}

/** Every cycle's analysis, oldest first. */
export function analyzeAllCycles(entries: Entry[]): CycleAnalysis[] {
  const starts = derivePeriods(entries).map((p) => p.start);
  return starts.map((start, i) => analyzeCycle(entries, start, starts[i + 1] ?? null));
}

/** Median luteal length (confirmed ovulation → next period) over the last 3
 * confirmed cycles, clamped to a physiological 10–16 days; null if none. */
export function personalLutealLength(entries: Entry[]): number | null {
  const starts = derivePeriods(entries).map((p) => p.start);
  const lengths: number[] = [];
  starts.forEach((start, i) => {
    const next = starts[i + 1];
    if (!next) return;
    const a = analyzeCycle(entries, start, next);
    if (a.ovulationConfirmed && a.ovulationEstimate) lengths.push(diffDays(a.ovulationEstimate, next));
  });
  const recent = lengths.slice(-3).sort((a, b) => a - b);
  if (!recent.length) return null;
  const mid = recent[Math.floor(recent.length / 2)]!;
  return Math.min(LUTEAL_MAX, Math.max(LUTEAL_MIN, mid));
}
