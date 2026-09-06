// src/lib/gerstner-wave.ts — ADR-035's ocean. Three fixed Gerstner waves
// (the standard GPU Gems 1, ch.1 formulation) — art-directed constants
// (direction/wavelength/steepness/amplitude), not per-cyclePhase data;
// only the overall chop (amplitude/steepness scale) and speed (phase-speed
// scale) come from WEATHER_MOODS, so the wave *shape* stays constant while
// its intensity breathes with the cycle.
//
// This is the single source of truth for the wave constants — Ocean.tsx's
// GLSL reads them as uniforms built from this same array (not duplicated
// as separate shader literals), and gerstnerHeight below is the CPU-side
// mirror of that same vertex shader, used to bob Boat.tsx on the actual
// surface instead of an independent decorative sine.
export interface GerstnerWave {
  direction: readonly [number, number];
  wavelength: number;
  steepness: number;
  amplitude: number;
}

export const GERSTNER_WAVES: readonly GerstnerWave[] = [
  { direction: [1.0, 0.4], wavelength: 6.0, steepness: 0.5, amplitude: 0.12 },
  { direction: [-0.6, 0.9], wavelength: 3.5, steepness: 0.4, amplitude: 0.07 },
  { direction: [0.3, -0.8], wavelength: 1.8, steepness: 0.3, amplitude: 0.04 },
];

const GRAVITY = 9.8;

/** Height (in the ocean mesh's own local/ground space) at ground
 * coordinates (x,y) and time t, scaled by the same uChop/uSpeed the
 * shader's uniforms receive. Pure sum-of-sines — matches the vertex
 * shader's `applyWave` exactly, term for term. */
export function gerstnerHeight(x: number, y: number, t: number, chop: number, speed: number): number {
  let height = 0;
  for (const wave of GERSTNER_WAVES) {
    const k = (2 * Math.PI) / wave.wavelength;
    const c = Math.sqrt(GRAVITY / k) * speed;
    const len = Math.hypot(wave.direction[0], wave.direction[1]);
    const dx = wave.direction[0] / len;
    const dy = wave.direction[1] / len;
    const f = k * (dx * x + dy * y - c * t);
    const a = wave.amplitude * chop;
    height += a * Math.sin(f);
  }
  return height;
}

/** Converts a world (x,z) position into the ocean mesh's local ground
 * space and returns the real surface height there — the function Boat.tsx
 * actually calls. The mesh is rotated -90° on X (see Ocean.tsx), which
 * maps local Y to world -Z relative to the mesh's own position, i.e.
 * local groundY = oceanZ - worldZ; local groundX = worldX (the mesh has no
 * X offset). Keeping that mapping here, in one place, means Boat.tsx never
 * needs to know the mesh's rotation convention itself. */
export function oceanWorldHeight(
  worldX: number,
  worldZ: number,
  oceanY: number,
  oceanZ: number,
  t: number,
  chop: number,
  speed: number,
): number {
  const groundY = oceanZ - worldZ;
  return oceanY + gerstnerHeight(worldX, groundY, t, chop, speed);
}
