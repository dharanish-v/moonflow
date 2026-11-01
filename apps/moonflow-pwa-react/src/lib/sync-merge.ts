// src/lib/sync-merge.ts — T99 (ADR-054). The decisions sync makes, as pure
// functions: which copy of a day wins, how settings merge, and how app values
// map to the server's (PocketBase has no null — an empty select or text, or a
// number 0, means "not set"; docs/data-format.md §6).
import type { Tombstone } from './db';
import { SYNCED_SETTING_KEYS } from './db';
import type { Entry, FlowId, MoodId, MucusId, Settings, SymptomId } from './types';

export interface RemoteEntry {
  id: string;
  date: string;
  flow: FlowId | '';
  symptoms: SymptomId[];
  mood: MoodId | '';
  note: string;
  tags: string[] | null;
  temperature: number;
  tempDisturbed: boolean;
  mucus: MucusId | '';
  updatedAt: number;
  deleted: boolean;
  updated: string;
}

export type SyncedSettings = Pick<Settings, (typeof SYNCED_SETTING_KEYS)[number]>;

export interface RemoteSettings extends Omit<SyncedSettings, 'lastPeriodStart' | 'birthYear' | 'customTags' | 'confirmedLongCycles'> {
  id: string;
  lastPeriodStart: string;
  birthYear: number;
  customTags: string[] | null;
  confirmedLongCycles: string[] | null;
  updatedAt: number;
}

/** What to do with a day the server sent. Newest updatedAt wins; a tie means
 * both sides already agree. */
export function decideEntry(remote: Pick<RemoteEntry, 'updatedAt'>, local: Entry | undefined, tombstone: Tombstone | undefined): 'take-remote' | 'keep-local' | 'same' {
  const localTime = local ? local.updatedAt : tombstone ? tombstone.deletedAt : -1;
  if (remote.updatedAt > localTime) return 'take-remote';
  if (remote.updatedAt < localTime) return 'keep-local';
  return 'same';
}

export function entryFromRemote(r: RemoteEntry): Entry {
  return {
    date: r.date,
    flow: r.flow || null,
    symptoms: r.symptoms ?? [],
    mood: r.mood || null,
    note: r.note ?? '',
    tags: r.tags ?? [],
    temperature: r.temperature ? r.temperature : null,
    tempDisturbed: r.tempDisturbed,
    mucus: r.mucus || null,
    updatedAt: r.updatedAt,
  };
}

export function entryToRemote(e: Entry) {
  return {
    date: e.date,
    flow: e.flow ?? '',
    symptoms: e.symptoms,
    mood: e.mood ?? '',
    note: e.note,
    tags: e.tags ?? [],
    temperature: e.temperature ?? 0,
    tempDisturbed: e.tempDisturbed ?? false,
    mucus: e.mucus ?? '',
    updatedAt: e.updatedAt,
    deleted: false,
  };
}

/** Custom tags merge as a union (ADR-054): a tag added on one device never
 * disappears because another device's settings were newer. Order: first
 * list's order, then new ones. */
export function unionTags(a: readonly string[], b: readonly string[]): string[] {
  const seen = new Set(a);
  return [...a, ...b.filter((t) => !seen.has(t) && seen.add(t))];
}

export function settingsFromRemote(r: RemoteSettings): SyncedSettings {
  return {
    lastPeriodStart: r.lastPeriodStart || null,
    avgCycleLength: r.avgCycleLength,
    avgPeriodLength: r.avgPeriodLength,
    predictionsPaused: r.predictionsPaused,
    customTags: r.customTags ?? [],
    birthYear: r.birthYear || null,
    perimenopauseMode: r.perimenopauseMode,
    fertilityAwareness: r.fertilityAwareness,
    temperatureUnit: r.temperatureUnit || 'C',
    confirmedLongCycles: r.confirmedLongCycles ?? [],
  };
}

export function settingsToRemote(s: SyncedSettings, updatedAt: number) {
  return {
    lastPeriodStart: s.lastPeriodStart ?? '',
    avgCycleLength: s.avgCycleLength,
    avgPeriodLength: s.avgPeriodLength,
    predictionsPaused: s.predictionsPaused,
    customTags: s.customTags,
    birthYear: s.birthYear ?? 0,
    perimenopauseMode: s.perimenopauseMode,
    fertilityAwareness: s.fertilityAwareness,
    temperatureUnit: s.temperatureUnit,
    confirmedLongCycles: s.confirmedLongCycles,
    updatedAt,
  };
}

export function pickSynced(s: Settings): SyncedSettings {
  return Object.fromEntries(SYNCED_SETTING_KEYS.map((k) => [k, s[k]])) as SyncedSettings;
}
