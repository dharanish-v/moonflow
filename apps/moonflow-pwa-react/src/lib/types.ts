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
}

/** The stored/loaded shape — db.ts stamps `updatedAt` on every write. */
export interface Entry extends LogEntryInput {
  updatedAt: number;
}

export interface Period {
  start: string;
  end: string;
}

export type PredictNextPeriodResult =
  | { date: string; confidence: 'estimated' | 'confirmed'; rangeStart?: undefined; rangeEnd?: undefined }
  | { rangeStart: string; rangeEnd: string; confidence: 'wide'; date?: undefined };

export interface FertileWindow {
  start: string;
  end: string;
  peak: string;
}

export interface Settings {
  onboardingComplete: boolean;
  lastPeriodStart: string | null;
  avgCycleLength: number;
  avgPeriodLength: number;
  pinHash: string | null;
  pinLockEnabled: boolean;
  pinFailedAttempts: number;
  pinLockoutUntil: number | null;
  soundEnabled: boolean;
  draftEntry: LogEntryInput | null;
}

export type SettingKey = keyof Settings;
