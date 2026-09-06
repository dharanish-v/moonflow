// src/lib/constants.ts — single source of truth for options and thresholds
// referenced across multiple screens and cycle-math.ts. Ported verbatim from
// the vanilla app's constants.js — add a symptom/mood/flow option here once,
// not in every screen that displays one.
import type { FlowId, MoodId, SymptomId } from './types';

export const FLOW_OPTIONS: ReadonlyArray<{ id: FlowId; label: string }> = [
  { id: 'none', label: 'None' },
  { id: 'spotting', label: 'Spotting' },
  { id: 'light', label: 'Light' },
  { id: 'medium', label: 'Medium' },
  { id: 'heavy', label: 'Heavy' },
];

// Flow levels that count as real period days for period-boundary detection.
// 'none' and 'spotting' are deliberately excluded — see the cycle-math
// edge-case rules in design-system.md and ADR-012.
export const PERIOD_FLOW_LEVELS: ReadonlyArray<FlowId> = ['light', 'medium', 'heavy'];

export const SYMPTOM_OPTIONS: ReadonlyArray<{ id: SymptomId; label: string }> = [
  { id: 'cramps', label: 'Cramps' },
  { id: 'headache', label: 'Headache' },
  { id: 'bloating', label: 'Bloating' },
  { id: 'fatigue', label: 'Fatigue' },
  { id: 'backache', label: 'Backache' },
  { id: 'nausea', label: 'Nausea' },
  { id: 'tender_breasts', label: 'Tender breasts' },
  { id: 'acne', label: 'Acne' },
];

export const MOOD_OPTIONS: ReadonlyArray<{ id: MoodId; icon: string }> = [
  { id: 'cry', icon: 'mood-cry' },
  { id: 'sad', icon: 'mood-sad' },
  { id: 'neutral', icon: 'mood-neutral' },
  { id: 'smile', icon: 'mood-smile' },
  { id: 'happy', icon: 'mood-happy' },
];

// Cycle-math thresholds — see technical-design.md for the reasoning behind each.
export const PERIOD_GAP_TOLERANCE_DAYS = 2; // missed-log tolerance before splitting into a new period
export const VARIABILITY_THRESHOLD_DAYS = 4; // above this, predictions show a range instead of a single date
export const LUTEAL_PHASE_DAYS = 14; // luteal phase is far more consistent than follicular — standard heuristic
export const FERTILE_WINDOW_BEFORE_OVULATION_DAYS = 5;
export const FERTILE_WINDOW_AFTER_OVULATION_DAYS = 1;

// PIN lock behavior — see the security edge-case rules.
export const PIN_LOCKOUT_AFTER_ATTEMPTS = 5;
export const PIN_LOCKOUT_SECONDS = 30;
export const PIN_RELOCK_AFTER_MINUTES = 2;
