import { describe, expect, it } from 'vitest';
import { moonPhase } from './lunar';

describe('moonPhase', () => {
  it('is new at the 8 April 2024 eclipse', () => {
    const p = moonPhase(new Date(Date.UTC(2024, 3, 8, 18, 21)));
    expect(p.illumination).toBeLessThan(0.02);
  });

  it('is full on 23 April 2024', () => {
    const p = moonPhase(new Date(Date.UTC(2024, 3, 23, 23, 49)));
    expect(p.illumination).toBeGreaterThan(0.98);
  });

  it('knows waxing from waning', () => {
    expect(moonPhase(new Date(Date.UTC(2024, 3, 12))).waxing).toBe(true);
    expect(moonPhase(new Date(Date.UTC(2024, 3, 28))).waxing).toBe(false);
  });

  it('names the phase', () => {
    expect(moonPhase(new Date(Date.UTC(2024, 3, 8, 18, 21))).name).toBe('New moon');
    expect(moonPhase(new Date(Date.UTC(2024, 3, 23, 23, 49))).name).toBe('Full moon');
    expect(moonPhase(new Date(Date.UTC(2024, 3, 11))).name).toBe('Waxing crescent');
  });
});
