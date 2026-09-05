// @ts-check
// gestures.js — pure decision logic for the log-entry sheet's swipe-to-dismiss
// (ADR-015: native Pointer Events, no gesture library). Kept separate from the
// actual pointerdown/move/up wiring in log-entry.js so the threshold math is
// unit-testable without simulating real pointer events — see
// tests/animation-tests.html.

// Exported (not just used internally) so log-entry.js's drag handler can fire
// a haptic tick at the exact same distance this decision itself uses, rather
// than a second hand-copied magic number that could quietly drift out of sync.
export const DISMISS_DISTANCE_PX = 80;
const DISMISS_VELOCITY_PX_PER_MS = 0.5;

/**
 * @param {{deltaY: number, velocity: number}} args deltaY: total downward drag
 *   distance in px (negative/zero means dragging up or not moved — never
 *   dismiss on an upward drag); velocity: px/ms at release, always >= 0.
 */
export function shouldDismissSheet({ deltaY, velocity }) {
  if (deltaY <= 0) return false;
  return deltaY > DISMISS_DISTANCE_PX || velocity > DISMISS_VELOCITY_PX_PER_MS;
}
