// New coverage — moon-phase.ts had no dedicated test file in the vanilla app
// (only exercised indirectly via home.js's own manual checks).
import { describe, expect, it } from 'vitest';
import { getMoonPhase, illuminationFraction, moonPhaseLabel, phaseToLightAngle } from './moon-phase';

describe('getMoonPhase', () => {
  it('returns exactly 0 at the known reference new moon instant', () => {
    expect(getMoonPhase(new Date(Date.UTC(2000, 0, 6, 18, 14)))).toBeCloseTo(0, 5);
  });

  it('always normalizes into [0, 1)', () => {
    for (const date of [new Date(1990, 0, 1), new Date(2050, 5, 15), new Date(2026, 8, 6)]) {
      const phase = getMoonPhase(date);
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThan(1);
    }
  });
});

describe('illuminationFraction', () => {
  it('is 0 at new moon and 1 at full moon', () => {
    expect(illuminationFraction(0)).toBeCloseTo(0, 5);
    expect(illuminationFraction(0.5)).toBeCloseTo(1, 5);
  });
});

describe('moonPhaseLabel', () => {
  it('labels the boundary phases correctly', () => {
    expect(moonPhaseLabel(0)).toBe('new moon');
    expect(moonPhaseLabel(0.25)).toBe('first quarter');
    expect(moonPhaseLabel(0.5)).toBe('full moon');
    expect(moonPhaseLabel(0.75)).toBe('last quarter');
  });
});

describe('phaseToLightAngle', () => {
  it('places the light in front (z=1, x=0) at new moon', () => {
    const { x, z } = phaseToLightAngle(0);
    expect(x).toBeCloseTo(0, 5);
    expect(z).toBeCloseTo(1, 5);
  });

  it('places the light behind (z=-1, x=0) at full moon', () => {
    const { x, z } = phaseToLightAngle(0.5);
    expect(x).toBeCloseTo(0, 5);
    expect(z).toBeCloseTo(-1, 5);
  });

  it('always returns a unit vector', () => {
    for (const phase of [0.1, 0.3, 0.6, 0.9]) {
      const { x, z } = phaseToLightAngle(phase);
      expect(x * x + z * z).toBeCloseTo(1, 5);
    }
  });
});
