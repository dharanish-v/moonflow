// src/lib/log-entry.ts — pure helpers ported from log-entry.js: what a
// freshly opened log-entry screen should be pre-filled with, and its header
// date label.
import { parseDate } from './cycle-math';
import type { Entry, LogEntryInput } from './types';

export interface ResolvedDraft {
  flow: LogEntryInput['flow'];
  symptoms: LogEntryInput['symptoms'];
  mood: LogEntryInput['mood'];
  note: string;
  fromDraft: boolean;
}

/**
 * An in-progress draft for this exact date (T20) takes priority over a
 * previously saved entry, since it represents more recent unsaved edits; a
 * draft for any other date is ignored outright, so a stale draft never leaks
 * into a different day's fresh form.
 */
export function resolveInitialDraft(
  date: string,
  existingEntry: Entry | null,
  draftEntry: LogEntryInput | null,
): ResolvedDraft {
  const source = draftEntry && draftEntry.date === date ? draftEntry : existingEntry;
  return {
    flow: source?.flow ?? null,
    symptoms: source?.symptoms ?? [],
    mood: source?.mood ?? null,
    note: source?.note ?? '',
    fromDraft: source === draftEntry && draftEntry !== null,
  };
}

/** @param dateStr "YYYY-MM-DD" */
export function formatHeaderDate(dateStr: string, today: Date = new Date()): string {
  const date = parseDate(dateStr);
  const isToday = date.toDateString() === today.toDateString();
  const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return isToday ? `Today, ${label}` : label;
}
