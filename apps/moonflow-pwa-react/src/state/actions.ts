// src/state/actions.ts — flat state shape (mirrors store.js 1:1) + a real
// discriminated-union Action type. Derived values (cycle day, days-to-next-
// period) are never stored here — always computed from entries/settings at
// read time (technical-design.md's explicit invariant).

import { todayString } from '../lib/cycle-math';
import { SETTINGS_DEFAULTS } from '../lib/db';
import type { Entry, Settings } from '../lib/types';

export interface AppState {
  /** Whether the initial IndexedDB load has finished. */
  booted: boolean;
  /** The boot read failed — show a retry screen, never a first-run state. */
  bootError: boolean;
  /** Bumped by BOOT_RETRY; the store re-runs the boot read when it changes. */
  bootAttempt: number;
  entries: Entry[];
  settings: Settings;
  /** "YYYY-MM" */
  calendarMonth: string;
  /** "YYYY-MM-DD" — kept current by the store (midnight + resume), so every
   * screen re-renders when the day changes while the app stays open. */
  today: string;
}

export type Action =
  | { type: 'BOOT_LOADED'; entries: Entry[]; settings: Settings }
  | { type: 'BOOT_FAILED' }
  | { type: 'BOOT_RETRY' }
  | { type: 'SET_ENTRIES'; entries: Entry[] }
  | { type: 'UPSERT_ENTRY'; entry: Entry }
  | { type: 'REMOVE_ENTRY'; date: string }
  | { type: 'PATCH_SETTINGS'; patch: Partial<Settings> }
  | { type: 'SET_CALENDAR_MONTH'; month: string }
  | { type: 'DAY_CHANGED'; today: string };

function currentMonth(): string {
  return todayString().slice(0, 7);
}

export const initialState: AppState = {
  booted: false,
  bootError: false,
  bootAttempt: 0,
  entries: [],
  settings: SETTINGS_DEFAULTS,
  calendarMonth: currentMonth(),
  today: todayString(),
};

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'BOOT_LOADED':
      return { ...state, booted: true, bootError: false, entries: action.entries, settings: action.settings };
    case 'BOOT_FAILED':
      return { ...state, booted: false, bootError: true };
    case 'BOOT_RETRY':
      return { ...state, booted: false, bootError: false, bootAttempt: state.bootAttempt + 1 };
    case 'SET_ENTRIES':
      return { ...state, entries: action.entries };
    case 'UPSERT_ENTRY': {
      const rest = state.entries.filter((e) => e.date !== action.entry.date);
      const entries = [...rest, action.entry].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      return { ...state, entries };
    }
    case 'REMOVE_ENTRY':
      return { ...state, entries: state.entries.filter((e) => e.date !== action.date) };
    case 'PATCH_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'DAY_CHANGED': {
      // Follow the calendar into a new month only if it was showing "now".
      const wasOnCurrentMonth = state.calendarMonth === state.today.slice(0, 7);
      return {
        ...state,
        today: action.today,
        calendarMonth: wasOnCurrentMonth ? action.today.slice(0, 7) : state.calendarMonth,
      };
    }
    case 'SET_CALENDAR_MONTH':
      return { ...state, calendarMonth: action.month };
    default:
      return state;
  }
}
