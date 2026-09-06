// src/lib/sky-mood.ts — ADR-033. HomeScene's own sky/cloud/star mood per
// cyclePhase, deliberately separate from moon-phase.ts's phaseToLightAngle
// (real astronomy, untouched by this file entirely) — two independent
// signals sharing one screen, not one system. Pure config + math only, no
// React/Three.js imports, same testing split moon-phase.ts already draws
// (its own math is unit-tested here; HomeScene.tsx's use of it is verified
// live, since jsdom has no WebGL).
import type { CyclePhase } from './home-status';

export interface SkyMood {
  /** drei <Sky>'s sun elevation, 0–1 — near 0 reads as night, higher as day. */
  inclination: number;
  /** drei <Sky>'s sun rotation around Y, 0–1. */
  azimuth: number;
  turbidity: number;
  rayleigh: number;
  mieCoefficient: number;
  mieDirectionalG: number;
  /** Tint for the procedural cloud puffs — see cloud-texture.ts. */
  cloudColor: string;
  cloudOpacity: number;
  /** Drift speed fed to drei <Cloud>'s speed prop — the "wind." */
  cloudSpeed: number;
  /** Overall star-field opacity, 0–1. */
  starOpacity: number;
  /** Tint + strength for the additive glow sprite behind the moon — the
   * bridge between the moon's photoreal texture and this stylized sky. */
  glowColor: string;
  glowIntensity: number;
}

export const SKY_MOODS: Record<CyclePhase, SkyMood> = {
  period: {
    inclination: 0.02,
    azimuth: 0.25,
    turbidity: 2,
    rayleigh: 0.4,
    mieCoefficient: 0.003,
    mieDirectionalG: 0.7,
    cloudColor: '#2a2850',
    cloudOpacity: 0.25,
    cloudSpeed: 0.15,
    starOpacity: 1,
    glowColor: '#d99fc0',
    glowIntensity: 0.35,
  },
  follicular: {
    inclination: 0.18,
    azimuth: 0.3,
    turbidity: 6,
    rayleigh: 1.5,
    mieCoefficient: 0.008,
    mieDirectionalG: 0.8,
    cloudColor: '#f2c9d1',
    cloudOpacity: 0.45,
    cloudSpeed: 0.3,
    starOpacity: 0.25,
    glowColor: '#f2c9d1',
    glowIntensity: 0.5,
  },
  // The "peak ovulation, full moon, beautiful sky" hero moment — brightest,
  // warmest, most saturated of all five moods, on purpose.
  fertile: {
    inclination: 0.55,
    azimuth: 0.25,
    turbidity: 8,
    rayleigh: 2.2,
    mieCoefficient: 0.01,
    mieDirectionalG: 0.85,
    cloudColor: '#ffe9bf',
    cloudOpacity: 0.6,
    cloudSpeed: 0.45,
    starOpacity: 0,
    glowColor: '#ffe9bf',
    glowIntensity: 0.85,
  },
  luteal: {
    inclination: 0.12,
    azimuth: 0.2,
    turbidity: 5,
    rayleigh: 1.2,
    mieCoefficient: 0.007,
    mieDirectionalG: 0.78,
    cloudColor: '#d99fc0',
    cloudOpacity: 0.5,
    cloudSpeed: 0.35,
    starOpacity: 0.15,
    glowColor: '#e8a887',
    glowIntensity: 0.6,
  },
  // No cycle-phase signal to show honestly yet (same case computeHomeStatus
  // already falls back to "predictions need a bit more history" for) —
  // subdued and low-saturation on purpose, not a strong direction.
  unknown: {
    inclination: 0.1,
    azimuth: 0.25,
    turbidity: 3,
    rayleigh: 0.8,
    mieCoefficient: 0.005,
    mieDirectionalG: 0.75,
    cloudColor: '#8f8db8',
    cloudOpacity: 0.3,
    cloudSpeed: 0.2,
    starOpacity: 0.1,
    glowColor: '#cbc9e8',
    glowIntensity: 0.3,
  },
};

/**
 * Linear-interpolates every numeric field between two moods — used for a
 * smooth crossfade in HomeScene's useFrame when cyclePhase changes, not a
 * hard cut. Color fields are hex strings, not numbers — interpolating them
 * meaningfully needs THREE.Color, which this pure module deliberately
 * doesn't import; they snap to the target mood's color exactly once the
 * transition completes (t >= 1), not at the start of it.
 */
export function lerpSkyMood(a: SkyMood, b: SkyMood, t: number): SkyMood {
  const clampedT = Math.min(1, Math.max(0, t));
  // t=0/t=1 return a/b directly rather than running them through the lerp
  // formula — floating-point arithmetic doesn't guarantee
  // `x + (y - x) * 1 === y` bit-for-bit, and "the transition is over" should
  // mean the mood *is* the target, exactly, not off by an epsilon.
  if (clampedT === 0) return a;
  if (clampedT === 1) return b;
  const lerp = (x: number, y: number) => x + (y - x) * clampedT;
  return {
    inclination: lerp(a.inclination, b.inclination),
    azimuth: lerp(a.azimuth, b.azimuth),
    turbidity: lerp(a.turbidity, b.turbidity),
    rayleigh: lerp(a.rayleigh, b.rayleigh),
    mieCoefficient: lerp(a.mieCoefficient, b.mieCoefficient),
    mieDirectionalG: lerp(a.mieDirectionalG, b.mieDirectionalG),
    cloudColor: a.cloudColor,
    cloudOpacity: lerp(a.cloudOpacity, b.cloudOpacity),
    cloudSpeed: lerp(a.cloudSpeed, b.cloudSpeed),
    starOpacity: lerp(a.starOpacity, b.starOpacity),
    glowColor: a.glowColor,
    glowIntensity: lerp(a.glowIntensity, b.glowIntensity),
  };
}
