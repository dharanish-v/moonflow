// src/lib/moon-phase.ts — real lunar-phase astronomy (ADR-019), deliberately
// separate from cycle-math.ts's cycle-day prediction. Accurate to about a
// day — fine for an illustration, not scientific use.
//
// Ported math only: ~SVG renderer (renderMoonPhaseSVG) is superseded by the
// React Three Fiber component (Phase 5) and intentionally not ported here.

const SYNODIC_MONTH_DAYS = 29.530588853;
const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14); // a known new moon reference instant

/** @returns 0 = new moon, 0.5 = full moon, approaching 1 = new moon again */
export function getMoonPhase(date: Date): number {
  const daysSince = (date.getTime() - KNOWN_NEW_MOON_MS) / 86400000;
  const phase = daysSince / SYNODIC_MONTH_DAYS;
  return ((phase % 1) + 1) % 1; // normalize into [0, 1)
}

/** 0 at new, 1 at full */
export function illuminationFraction(phase: number): number {
  return (1 - Math.cos(2 * Math.PI * phase)) / 2;
}

export function moonPhaseLabel(phase: number): string {
  if (phase < 0.03 || phase > 0.97) return 'new moon';
  if (phase < 0.22) return 'waxing crescent';
  if (phase < 0.28) return 'first quarter';
  if (phase < 0.47) return 'waxing gibbous';
  if (phase < 0.53) return 'full moon';
  if (phase < 0.72) return 'waning gibbous';
  if (phase < 0.78) return 'last quarter';
  return 'waning crescent';
}

/**
 * Where the real directional light sits for MoonPhase3D — a lit sphere +
 * one light positioned by this angle produces a correct terminator curve
 * for free (real physics, not a hand-authored path). x/z, not x/y: the
 * sphere sits at the scene origin viewed from +z, so the light needs to
 * orbit in the horizontal plane to sweep the visible terminator left-right.
 */
export function phaseToLightAngle(phase: number): { x: number; z: number } {
  const angle = phase * Math.PI * 2;
  return { x: Math.sin(angle), z: Math.cos(angle) };
}
