import { describe, expect, it } from 'vitest';
import { quoteOfTheDay } from './quotes';

describe('quoteOfTheDay', () => {
  it('is deterministic for the same day and phase', () => {
    const day = new Date(2026, 8, 6);
    expect(quoteOfTheDay('period', day)).toBe(quoteOfTheDay('period', day));
  });

  it('changes with the day', () => {
    const a = quoteOfTheDay('fertile', new Date(2026, 8, 6));
    const b = quoteOfTheDay('fertile', new Date(2026, 8, 7));
    // Not a strict guarantee for every possible pair (pool could wrap and
    // repeat), but this pool is long enough that adjacent days differ.
    expect(a).not.toBe(b);
  });

  it("falls back to the phase-neutral pool for 'unknown'", () => {
    const quote = quoteOfTheDay('unknown', new Date(2026, 8, 6));
    expect(typeof quote).toBe('string');
    expect(quote.length).toBeGreaterThan(0);
  });

  it('returns a non-empty string for every real phase', () => {
    for (const phase of ['period', 'follicular', 'fertile', 'luteal'] as const) {
      expect(quoteOfTheDay(phase, new Date(2026, 8, 6)).length).toBeGreaterThan(0);
    }
  });
});
