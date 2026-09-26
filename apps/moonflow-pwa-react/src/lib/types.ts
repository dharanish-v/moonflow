// src/lib/types.ts — shared domain types, ported from the vanilla app's JSDoc
// annotations (scattered across cycle-math.js/db.js/constants.js) into real,
// centrally-defined TypeScript types every module below imports.

export type FlowId = 'none' | 'spotting' | 'light' | 'medium' | 'heavy';
export type SymptomId =
  | 'cramps'
  | 'headache'
  | 'bloating'
  | 'fatigue'
  | 'backache'
  | 'nausea'
  | 'tender_breasts'
  | 'acne';
export type MoodId = 'cry' | 'sad' | 'neutral' | 'smile' | 'happy';

/** What a screen produces when saving/drafting a day's log. */
export interface LogEntryInput {
  date: string; // "YYYY-MM-DD"
  flow: FlowId | null;
  symptoms: SymptomId[];
  mood: MoodId | null;
  note: string;
  /** User-defined tags (T68): medication, pill taken, sleep, energy… */
  tags?: string[];
}

/** The stored/loaded shape — db.ts stamps `updatedAt` on every write. */
export interface Entry extends LogEntryInput {
  updatedAt: number;
}

export interface Period {
  start: string;
  end: string;
}

/** 'system' follows the OS/browser prefers-color-scheme; 'light'/'dark'
 * force that world regardless of it. See useResolvedTheme.ts. */
export type ThemeMode = 'system' | 'light' | 'dark';

export interface Settings {
  onboardingComplete: boolean;
  lastPeriodStart: string | null;
  avgCycleLength: number;
  avgPeriodLength: number;
  pinHash: string | null;
  /** A second PIN that opens the empty decoy database instead (T48). */
  duressPinHash: string | null;
  pinLockEnabled: boolean;
  pinFailedAttempts: number;
  pinLockoutUntil: number | null;
  draftEntry: LogEntryInput | null;
  themeMode: ThemeMode;
  /** Pregnancy, breastfeeding, hormonal birth control… — logging continues,
   * predictions and health nudges stop (T65). */
  predictionsPaused: boolean;
  /** The user's own tag vocabulary, offered as chips in the log sheet (T68). */
  customTags: string[];
  /** Epoch ms of the last successful export (T47). */
  lastBackupAt: number | null;
}

export type SettingKey = keyof Settings;
