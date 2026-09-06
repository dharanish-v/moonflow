import { describe, expect, it } from 'vitest';
import { lerpSkyMood, SKY_MOODS } from './sky-mood';

describe('SKY_MOODS', () => {
  it('defines all five cyclePhase moods', () => {
    expect(Object.keys(SKY_MOODS).sort()).toEqual(['fertile', 'follicular', 'luteal', 'period', 'unknown']);
  });

  it('makes fertile the brightest, most saturated mood — the peak-ovulation hero moment', () => {
    const inclinations = Object.values(SKY_MOODS).map((m) => m.inclination);
    expect(SKY_MOODS.fertile.inclination).toBe(Math.max(...inclinations));
    const glowIntensities = Object.values(SKY_MOODS).map((m) => m.glowIntensity);
    expect(SKY_MOODS.fertile.glowIntensity).toBe(Math.max(...glowIntensities));
    expect(SKY_MOODS.fertile.starOpacity).toBe(0);
  });

  it('makes period the darkest mood with the brightest stars', () => {
    const inclinations = Object.values(SKY_MOODS).map((m) => m.inclination);
    expect(SKY_MOODS.period.inclination).toBe(Math.min(...inclinations));
    const starOpacities = Object.values(SKY_MOODS).map((m) => m.starOpacity);
    expect(SKY_MOODS.period.starOpacity).toBe(Math.max(...starOpacities));
  });
});

describe('lerpSkyMood', () => {
  it('returns exactly a at t=0 and exactly b at t=1', () => {
    const a = SKY_MOODS.period;
    const b = SKY_MOODS.fertile;
    expect(lerpSkyMood(a, b, 0)).toEqual({ ...a, cloudColor: a.cloudColor, glowColor: a.glowColor });
    expect(lerpSkyMood(a, b, 1)).toEqual({ ...b, cloudColor: b.cloudColor, glowColor: b.glowColor });
  });

  it('interpolates numeric fields at the midpoint', () => {
    const a = SKY_MOODS.period;
    const b = SKY_MOODS.fertile;
    const mid = lerpSkyMood(a, b, 0.5);
    expect(mid.inclination).toBeCloseTo((a.inclination + b.inclination) / 2);
    expect(mid.starOpacity).toBeCloseTo((a.starOpacity + b.starOpacity) / 2);
  });

  it('snaps color fields to the target only once the transition completes', () => {
    const a = SKY_MOODS.period;
    const b = SKY_MOODS.fertile;
    expect(lerpSkyMood(a, b, 0.99).cloudColor).toBe(a.cloudColor);
    expect(lerpSkyMood(a, b, 1).cloudColor).toBe(b.cloudColor);
  });

  it('clamps t outside [0, 1]', () => {
    const a = SKY_MOODS.period;
    const b = SKY_MOODS.fertile;
    expect(lerpSkyMood(a, b, -5)).toEqual(lerpSkyMood(a, b, 0));
    expect(lerpSkyMood(a, b, 5)).toEqual(lerpSkyMood(a, b, 1));
  });
});
