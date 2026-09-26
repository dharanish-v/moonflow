// src/lib/import.ts — pure parse/validate for Settings → Import, the
// counterpart to export.ts. Deliberately restores only the actual cycle
// *data* (entries + lastPeriodStart/avgCycleLength/avgPeriodLength) — never
// the device-specific settings an export payload also happens to carry
// (pinHash, pinLockEnabled, pinFailedAttempts, pinLockoutUntil, draftEntry,
// soundEnabled, themeMode). Importing someone else's PIN hash onto this
// device, or clobbering a half-finished log draft, would be a real
// security/data-loss surprise a "bring my period data to my new phone"
// action shouldn't cause.

import { MAX_CYCLE_LENGTH, MAX_PERIOD_LENGTH, MIN_CYCLE_LENGTH, MIN_PERIOD_LENGTH } from './constants';
import { isRealDate } from './dates';
import { EXPORT_SCHEMA_VERSION } from './export';
import type { Entry, FlowId, MoodId, SymptomId } from './types';

/** Far beyond any real history (decades of daily logs is ~2MB). */
const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
export const MAX_NOTE_LENGTH = 10_000;
export const MAX_TAG_LENGTH = 40;
const MAX_TAGS_PER_DAY = 30;

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
  if (!isRealDate(e.date)) return null;
  if (e.flow !== null && !FLOW_IDS.has(e.flow as string)) return null;
  if (!Array.isArray(e.symptoms) || !e.symptoms.every((s) => SYMPTOM_IDS.has(s as string))) return null;
  if (e.mood !== null && !MOOD_IDS.has(e.mood as string)) return null;
  if (typeof e.note !== 'string' || e.note.length > MAX_NOTE_LENGTH) return null;
  const tags = e.tags === undefined ? [] : e.tags;
  if (
    !Array.isArray(tags) ||
    tags.length > MAX_TAGS_PER_DAY ||
    !tags.every((t) => typeof t === 'string' && t.trim().length > 0 && t.length <= MAX_TAG_LENGTH)
  ) {
    return null;
  }
  return {
    date: e.date,
    flow: e.flow as FlowId | null,
    symptoms: e.symptoms as SymptomId[],
    mood: e.mood as MoodId | null,
    note: e.note,
    tags: tags as string[],
    updatedAt: typeof e.updatedAt === 'number' ? e.updatedAt : Date.now(),
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Parses and validates a previously-exported Moonflow JSON file. */
export function parseImportPayload(json: string): ImportResult {
  if (json.length > MAX_IMPORT_BYTES) return { ok: false, error: "That file is too large to be a backup from this app." };
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }
  if (typeof parsed !== 'object' || parsed === null) return { ok: false, error: 'Unrecognized file format.' };

  const obj = parsed as Record<string, unknown>;
  if (typeof obj.schemaVersion === 'number' && obj.schemaVersion > EXPORT_SCHEMA_VERSION) {
    return { ok: false, error: 'This file is from a newer version of the app.' };
  }
  if (!Array.isArray(obj.entries) || typeof obj.settings !== 'object' || obj.settings === null) {
    return { ok: false, error: "This doesn't look like a backup from this app." };
  }

  const validEntries = obj.entries.map(normalizeEntry).filter((e): e is Entry => e !== null);
  const skippedEntries = obj.entries.length - validEntries.length;

  const rawSettings = obj.settings as Record<string, unknown>;
  const settings: ImportedSettings = {
    lastPeriodStart: isRealDate(rawSettings.lastPeriodStart) ? rawSettings.lastPeriodStart : null,
    avgCycleLength: clampNumber(rawSettings.avgCycleLength, MIN_CYCLE_LENGTH, MAX_CYCLE_LENGTH, 28),
    avgPeriodLength: clampNumber(rawSettings.avgPeriodLength, MIN_PERIOD_LENGTH, MAX_PERIOD_LENGTH, 5),
  };

  return { ok: true, payload: { entries: validEntries, settings }, skippedEntries };
}
