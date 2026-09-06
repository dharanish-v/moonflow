import { describe, expect, it } from 'vitest';
import { GERSTNER_WAVES, gerstnerHeight, oceanWorldHeight } from './gerstner-wave';

describe('gerstnerHeight', () => {
  it('is flat (zero) everywhere when chop is 0', () => {
    expect(gerstnerHeight(0, 0, 0, 0, 1)).toBeCloseTo(0);
    expect(gerstnerHeight(5, -3, 2.5, 0, 1)).toBeCloseTo(0);
  });

  it('stays within the sum of the wave amplitudes, scaled by chop', () => {
    const maxAmplitude = GERSTNER_WAVES.reduce((sum, w) => sum + w.amplitude, 0);
    for (let x = -10; x <= 10; x += 2.5) {
      for (let t = 0; t <= 3; t += 0.7) {
        const h = gerstnerHeight(x, -x, t, 1, 1);
        expect(Math.abs(h)).toBeLessThanOrEqual(maxAmplitude + 1e-9);
      }
    }
  });

  it('scales linearly with chop at a fixed point in time', () => {
    const base = gerstnerHeight(1.3, 2.1, 0.5, 1, 1);
    const doubled = gerstnerHeight(1.3, 2.1, 0.5, 2, 1);
    expect(doubled).toBeCloseTo(base * 2);
  });

  it('varies over time (the surface actually animates)', () => {
    const a = gerstnerHeight(2, 2, 0, 1, 1);
    const b = gerstnerHeight(2, 2, 1, 1, 1);
    expect(a).not.toBeCloseTo(b);
  });
});

describe('oceanWorldHeight', () => {
  it('matches gerstnerHeight at the mesh origin (world Z == oceanZ, world X == 0)', () => {
    const oceanY = -1.8;
    const oceanZ = -25;
    const direct = gerstnerHeight(0, 0, 1.2, 1, 1);
    const viaWorld = oceanWorldHeight(0, oceanZ, oceanY, oceanZ, 1.2, 1, 1) - oceanY;
    expect(viaWorld).toBeCloseTo(direct);
  });

  it('offsets by oceanY (the mesh sits at that world height when the surface itself is at rest)', () => {
    const flat = oceanWorldHeight(3, -20, -1.8, -25, 0, 0, 1);
    expect(flat).toBeCloseTo(-1.8);
  });
});
