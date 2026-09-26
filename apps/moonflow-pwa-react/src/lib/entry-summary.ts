// src/lib/entry-summary.ts — one short "what was logged" phrase for a day,
// shared by Home's today summary and Insights' recent-logs rows.
import { FLOW_OPTIONS, MOOD_OPTIONS } from './constants';
import type { Entry } from './types';

export function describeEntry(entry: Pick<Entry, 'flow' | 'symptoms' | 'mood' | 'note'>): string {
  const parts: string[] = [];
  if (entry.flow && entry.flow !== 'none') parts.push(`${FLOW_OPTIONS.find((f) => f.id === entry.flow)?.label ?? entry.flow} flow`);
  if (entry.flow === 'none') parts.push('No flow');
  if (entry.symptoms.length) parts.push(`${entry.symptoms.length} symptom${entry.symptoms.length === 1 ? '' : 's'}`);
  if (entry.mood) parts.push(`${MOOD_OPTIONS.find((m) => m.id === entry.mood)?.label ?? entry.mood} mood`);
  if (!parts.length && entry.note) parts.push('Note');
  return parts.length ? parts.slice(0, 2).join(' · ') : 'Logged';
}
