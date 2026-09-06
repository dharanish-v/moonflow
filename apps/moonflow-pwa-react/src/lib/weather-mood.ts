// src/lib/weather-mood.ts — ADR-035. Weather keyed to cyclePhase, shared by
// both the night-world (SKY_MOODS) and day-world (SUN_MOODS) scenes — one
// weather system, not duplicated per world, since "is it storming" doesn't
// depend on whether the moon or the sun is up. Deliberately a new, separate
// file/table rather than new fields bolted onto SKY_MOODS, so that
// already-tuned table stays byte-for-byte as it is.
//
// Mapping follows the emotional-weather convention directly requested:
// period reads as the stormiest (heaviest rain, most frequent lightning),
// fertile as the clearest and calmest.
import type { CyclePhase } from './home-status';

export interface WeatherMood {
  /** 0–1, scales rain particle count/opacity. */
  rainIntensity: number;
  /** Lightning flashes per minute — 0 disables lightning entirely. */
  lightningFrequency: number;
  /** Multiplies the ocean's Gerstner-wave amplitude/steepness. */
  oceanChop: number;
  /** Multiplies cloud drift and wave speed — the "wind." */
  windSpeed: number;
}

export const WEATHER_MOODS: Record<CyclePhase, WeatherMood> = {
  period: { rainIntensity: 0.85, lightningFrequency: 6, oceanChop: 1.5, windSpeed: 1.4 },
  follicular: { rainIntensity: 0.25, lightningFrequency: 0, oceanChop: 0.9, windSpeed: 1.0 },
  // The clearest, calmest weather — the same "peak" moment SKY_MOODS/
  // SUN_MOODS both give fertile.
  fertile: { rainIntensity: 0, lightningFrequency: 0, oceanChop: 0.5, windSpeed: 0.6 },
  luteal: { rainIntensity: 0.45, lightningFrequency: 1, oceanChop: 1.1, windSpeed: 1.1 },
  unknown: { rainIntensity: 0.1, lightningFrequency: 0, oceanChop: 0.7, windSpeed: 0.8 },
};
