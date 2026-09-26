// src/lib/search.ts — T70: find days by what was written or tagged.
import { FLOW_OPTIONS, MOOD_OPTIONS, SYMPTOM_OPTIONS } from './constants';
import type { Entry } from './types';

function haystack(e: Entry): string {
  return [
    e.note,
    ...(e.tags ?? []),
    ...e.symptoms.map((s) => SYMPTOM_OPTIONS.find((o) => o.id === s)?.label ?? s),
    FLOW_OPTIONS.find((o) => o.id === e.flow)?.label ?? '',
    MOOD_OPTIONS.find((o) => o.id === e.mood)?.label ?? '',
  ]
    .join(' ')
    .toLowerCase();
}

/** Every word of the query must appear somewhere in the day; newest first. */
export function searchEntries(entries: Entry[], query: string): Entry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return entries.filter((e) => words.every((w) => haystack(e).includes(w))).sort((a, b) => (a.date < b.date ? 1 : -1));
}
