// src/lib/import.ts — pure parse/validate for Settings → Import, the
// counterpart to export.ts. Deliberately restores only the actual cycle
// *data* (entries + lastPeriodStart/avgCycleLength/avgPeriodLength) — never
// the device-specific settings an export payload also happens to carry
// (pinHash, pinLockEnabled, pinFailedAttempts, pinLockoutUntil, draftEntry,
// soundEnabled, themeMode). Importing someone else's PIN hash onto this
// device, or clobbering a half-finished log draft, would be a real
// security/data-loss surprise a "bring my period data to my new phone"
// action shouldn't cause.

import type { Entry, FlowId, MoodId, SymptomId } from './types';

const FLOW_IDS: ReadonlySet<string> = new Set(['none', 'spotting', 'light', 'medium', 'heavy']);
const MOOD_IDS: ReadonlySet<string> = new Set(['cry', 'sad', 'neutral', 'smile', 'happy']);
const SYMPTOM_IDS: ReadonlySet<string> = new Set([
  'cramps',
  'headache',
  'bloating',
  'fatigue',
  'backache',
  'nausea',
  'tender_breasts',
  'acne',
]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface ImportedSettings {
  lastPeriodStart: string | null;
  avgCycleLength: number;
  avgPeriodLength: number;
}

export interface ImportPayload {
  entries: Entry[];
  settings: ImportedSettings;
}

export type ImportResult = { ok: true; payload: ImportPayload; skippedEntries: number } | { ok: false; error: string };

/** Coerces one raw entry, or returns null if it's malformed. Real files from
 * this app's own Export are always well-formed — this only guards against a
 * corrupted or hand-edited one, and drops just that entry rather than
 * failing the whole import. */
function normalizeEntry(value: unknown): Entry | null {
  if (typeof value !== 'object' || value === null) return null;
  const e = value as Record<string, unknown>;
  if (typeof e.date !== 'string' || !DATE_RE.test(e.date)) return null;
  if (e.flow !== null && !FLOW_IDS.has(e.flow as string)) return null;
  if (!Array.isArray(e.symptoms) || !e.symptoms.every((s) => SYMPTOM_IDS.has(s as string))) return null;
  if (e.mood !== null && !MOOD_IDS.has(e.mood as string)) return null;
  if (typeof e.note !== 'string') return null;
  return {
    date: e.date,
    flow: e.flow as FlowId | null,
    symptoms: e.symptoms as SymptomId[],
    mood: e.mood as MoodId | null,
    note: e.note,
    updatedAt: typeof e.updatedAt === 'number' ? e.updatedAt : Date.now(),
  };
}

/** Parses and validates a previously-exported Moonflow JSON file. */
export function parseImportPayload(json: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }
  if (typeof parsed !== 'object' || parsed === null) return { ok: false, error: 'Unrecognized file format.' };

  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.entries) || typeof obj.settings !== 'object' || obj.settings === null) {
    return { ok: false, error: "This doesn't look like a Moonflow export." };
  }

  const validEntries = obj.entries.map(normalizeEntry).filter((e): e is Entry => e !== null);
  const skippedEntries = obj.entries.length - validEntries.length;

  const rawSettings = obj.settings as Record<string, unknown>;
  const settings: ImportedSettings = {
    lastPeriodStart:
      typeof rawSettings.lastPeriodStart === 'string' && DATE_RE.test(rawSettings.lastPeriodStart)
        ? rawSettings.lastPeriodStart
        : null,
    avgCycleLength: typeof rawSettings.avgCycleLength === 'number' ? rawSettings.avgCycleLength : 28,
    avgPeriodLength: typeof rawSettings.avgPeriodLength === 'number' ? rawSettings.avgPeriodLength : 5,
  };

  return { ok: true, payload: { entries: validEntries, settings }, skippedEntries };
}
