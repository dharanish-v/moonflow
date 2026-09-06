import { describe, expect, it } from 'vitest';
import { SUN_MOODS } from './sun-mood';

describe('SUN_MOODS', () => {
  it('defines all five cyclePhase moods', () => {
    expect(Object.keys(SUN_MOODS).sort()).toEqual(['fertile', 'follicular', 'luteal', 'period', 'unknown']);
  });

  it('makes fertile the brightest, clearest day — the same hero moment SKY_MOODS gives it', () => {
    const inclinations = Object.values(SUN_MOODS).map((m) => m.inclination);
    expect(SUN_MOODS.fertile.inclination).toBe(Math.max(...inclinations));
    const rayleighs = Object.values(SUN_MOODS).map((m) => m.rayleigh);
    expect(SUN_MOODS.fertile.rayleigh).toBe(Math.max(...rayleighs));
    const glowIntensities = Object.values(SUN_MOODS).map((m) => m.glowIntensity);
    expect(SUN_MOODS.fertile.glowIntensity).toBe(Math.max(...glowIntensities));
  });

  it('makes period the stormiest, greyest day', () => {
    const turbidities = Object.values(SUN_MOODS).map((m) => m.turbidity);
    expect(SUN_MOODS.period.turbidity).toBe(Math.max(...turbidities));
    const cloudOpacities = Object.values(SUN_MOODS).map((m) => m.cloudOpacity);
    expect(SUN_MOODS.period.cloudOpacity).toBe(Math.max(...cloudOpacities));
  });

  it('never shows stars during the day', () => {
    for (const mood of Object.values(SUN_MOODS)) {
      expect(mood.starOpacity).toBe(0);
    }
  });
});
