// @ts-check
// store.js — minimal state + subscribe pattern (ADR-007). No library, ~20 lines.

/** @type {{
 *   activeScreen: string,
 *   isOnboarded: boolean,
 *   entries: Array<{date: string, flow: string|null, symptoms: string[], mood: string|null, note: string}>,
 *   settings: Record<string, any>,
 *   calendarMonth: string,
 *   editingDate: string|null,
 *   logFocusSection: 'flow'|'symptom'|'mood'|null
 * }} */
export const state = {
  activeScreen: 'home',
  isOnboarded: false,
  entries: [],
  settings: {},
  calendarMonth: '',
  editingDate: null,
  logFocusSection: null
};

const listeners = new Set();

/** @param {Partial<typeof state>} patch */
export function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach(fn => fn(state));
}

/** @param {(state: typeof state) => void} fn */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
