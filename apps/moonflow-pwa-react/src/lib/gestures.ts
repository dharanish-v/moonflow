// src/lib/gestures.ts — pure swipe-to-dismiss decision (ADR-015: native
// pointer events, no gesture library). Ported verbatim from gestures.js.
// Exported const, not inlined, so the drag handler's haptic tick fires at the
// exact same distance this decision uses — one number, not two copies.

export const DISMISS_DISTANCE_PX = 80;
const DISMISS_VELOCITY_PX_PER_MS = 0.5;

export interface ShouldDismissSheetArgs {
  /** total downward drag distance in px — negative/zero (dragging up, or no move) never dismisses */
  deltaY: number;
  /** px/ms at release, always >= 0 */
  velocity: number;
}

export function shouldDismissSheet({ deltaY, velocity }: ShouldDismissSheetArgs): boolean {
  if (deltaY <= 0) return false;
  return deltaY > DISMISS_DISTANCE_PX || velocity > DISMISS_VELOCITY_PX_PER_MS;
}
