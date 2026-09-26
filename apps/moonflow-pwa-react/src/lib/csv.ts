// src/lib/csv.ts — a human-readable export (T46): opens in Numbers/Excel/any
// text editor, so the data outlives this app. Not re-importable (JSON is the
// round-trip format).
import { FLOW_OPTIONS, MOOD_OPTIONS, MUCUS_OPTIONS, SYMPTOM_OPTIONS } from './constants';
import type { Entry } from './types';

const label = <T extends { id: string; label: string }>(opts: ReadonlyArray<T>, id: string | null) =>
  id ? (opts.find((o) => o.id === id)?.label ?? id) : '';

/** RFC 4180 quoting, plus a leading apostrophe on anything a spreadsheet would
 * run as a formula (=, +, -, @) — a note must never execute. */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) || safe !== value ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function buildCsv(entries: Entry[]): string {
  const rows = [...entries]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((e) =>
      [
        e.date,
        label(FLOW_OPTIONS, e.flow),
        e.symptoms.map((s) => label(SYMPTOM_OPTIONS, s)).join('; '),
        label(MOOD_OPTIONS, e.mood),
        (e.tags ?? []).join('; '),
        typeof e.temperature === 'number' ? e.temperature.toFixed(2) + (e.tempDisturbed ? ' (disturbed)' : '') : '',
        label(MUCUS_OPTIONS, e.mucus ?? null),
        e.note,
      ]
        .map(cell)
        .join(','),
    );
  return ['Date,Flow,Symptoms,Mood,Tags,Temperature (°C),Mucus,Note', ...rows].join('\r\n');
}
