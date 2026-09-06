// src/lib/sun-mood.ts — ADR-035's day-world counterpart to sky-mood.ts's
// SKY_MOODS, deliberately hand-authored rather than a programmatic
// inversion of it: inclination/turbidity/rayleigh don't invert into
// art-directed daylight values any more than they were art-directed as
// night values (SKY_MOODS.period.inclination = 0.02 near-zero reads as
// *night*; a naive 1-x inversion gives 0.98, a valid but arbitrary number,
// not a considered one). The *shape* of the dynamic is intentionally
// identical across both tables on purpose — fertile stays the brightest,
// clearest, most saturated hero moment here too, period stays the
// moodiest/stormiest — so the metaphor reads the same whether it's day-you
// or night-you. Reuses SkyMood's own shape (same rendering pipeline: drei
// <Sky> + cloud sprites + a glow sprite, just behind the sun instead of the
// moon) rather than duplicating the type, without unifying the *data* —
// this stays its own separate, independently-tuned table.
import type { CyclePhase } from './home-status';
import type { SkyMood } from './sky-mood';

export const SUN_MOODS: Record<CyclePhase, SkyMood> = {
  // The stormiest, greyest day — high turbidity/haze, low rayleigh
  // saturation, thick pale clouds, a sun barely glowing through overcast.
  period: {
    inclination: 0.25,
    azimuth: 0.25,
    turbidity: 10,
    rayleigh: 0.6,
    mieCoefficient: 0.02,
    mieDirectionalG: 0.9,
    cloudColor: '#a9b4bd',
    cloudOpacity: 0.75,
    cloudSpeed: 0.4,
    starOpacity: 0,
    glowColor: '#d8dce0',
    glowIntensity: 0.3,
  },
  follicular: {
    inclination: 0.4,
    azimuth: 0.3,
    turbidity: 6,
    rayleigh: 1.4,
    mieCoefficient: 0.01,
    mieDirectionalG: 0.82,
    cloudColor: '#f2e9d8',
    cloudOpacity: 0.4,
    cloudSpeed: 0.3,
    starOpacity: 0,
    glowColor: '#ffe9c2',
    glowIntensity: 0.55,
  },
  // The "peak ovulation, clearest brightest sky" hero moment — same role
  // this mood plays in SKY_MOODS, just daylight instead of moonlight.
  fertile: {
    inclination: 0.65,
    azimuth: 0.25,
    turbidity: 3,
    rayleigh: 2.6,
    mieCoefficient: 0.006,
    mieDirectionalG: 0.75,
    cloudColor: '#ffffff',
    cloudOpacity: 0.25,
    cloudSpeed: 0.5,
    starOpacity: 0,
    glowColor: '#fff4d6',
    glowIntensity: 0.9,
  },
  luteal: {
    inclination: 0.35,
    azimuth: 0.22,
    turbidity: 7,
    rayleigh: 1.2,
    mieCoefficient: 0.014,
    mieDirectionalG: 0.85,
    cloudColor: '#e8c9a8',
    cloudOpacity: 0.5,
    cloudSpeed: 0.35,
    starOpacity: 0,
    glowColor: '#f4b97a',
    glowIntensity: 0.6,
  },
  unknown: {
    inclination: 0.32,
    azimuth: 0.25,
    turbidity: 5,
    rayleigh: 1.0,
    mieCoefficient: 0.01,
    mieDirectionalG: 0.8,
    cloudColor: '#d6d2c4',
    cloudOpacity: 0.35,
    cloudSpeed: 0.25,
    starOpacity: 0,
    glowColor: '#e8e2d0',
    glowIntensity: 0.4,
  },
};
