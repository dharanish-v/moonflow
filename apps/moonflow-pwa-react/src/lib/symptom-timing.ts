// src/lib/symptom-timing.ts — T69. When in the cycle each symptom tends to
// show up ("Cramps usually around days 1–2", "Headache usually 2–3 days
// before your period"), so it can be anticipated. Only patterns seen in at
// least two cycles; the middle half of occurrences (25th–75th percentile),
// so a single outlier day doesn't stretch the range.
import { SYMPTOM_OPTIONS } from './constants';
import { derivePeriods, diffDays } from './cycle-math';
import type { Entry, SymptomId } from './types';

export interface SymptomTiming {
  id: SymptomId;
  label: string;
  text: string;
}

const MIN_CYCLES = 2;
/** A symptom centred in the first week is described by cycle day. */
const EARLY_CYCLE_DAYS = 7;
/** …one centred in the last ~10 days, relative to the next period. */
const PRE_PERIOD_DAYS = 10;

function quartiles(values: number[]): [number, number] {
  const s = [...values].sort((a, b) => a - b);
  return [s[Math.floor(0.25 * (s.length - 1))]!, s[Math.ceil(0.75 * (s.length - 1))]!];
}

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) / 2)]!;
const span = ([a, b]: [number, number]) => (a === b ? `${a}` : `${a}–${b}`);

export function symptomTiming(entries: Array<Pick<Entry, 'date' | 'flow' | 'symptoms'>>): SymptomTiming[] {
  const starts = derivePeriods(entries).map((p) => p.start);
  if (starts.length < MIN_CYCLES) return [];

  const byId = new Map<SymptomId, Array<{ cycle: string; day: number; before: number | null }>>();
  for (const e of entries) {
    const cycle = starts.filter((s) => s <= e.date).at(-1);
    if (!cycle) continue;
    const next = starts.find((s) => s > e.date);
    for (const id of e.symptoms) {
      const list = byId.get(id) ?? [];
      list.push({ cycle, day: diffDays(cycle, e.date) + 1, before: next ? diffDays(e.date, next) : null });
      byId.set(id, list);
    }
  }

  const out: SymptomTiming[] = [];
  for (const { id, label } of SYMPTOM_OPTIONS) {
    const hits = byId.get(id);
    if (!hits || new Set(hits.map((h) => h.cycle)).size < MIN_CYCLES) continue;
    const days = hits.map((h) => h.day);
    const befores = hits.map((h) => h.before).filter((b): b is number => b !== null);
    let text: string;
    if (median(days) <= EARLY_CYCLE_DAYS || befores.length < hits.length) {
      const [a, b] = quartiles(days);
      text = a === b ? `usually around day ${a}` : `usually around days ${span([a, b])}`;
    } else if (median(befores) <= PRE_PERIOD_DAYS) {
      const q = quartiles(befores);
      text = `usually ${span(q)} day${q[1] === 1 ? '' : 's'} before your period`;
    } else {
      text = `usually around days ${span(quartiles(days))}`;
    }
    out.push({ id, label, text });
  }
  return out;
}
