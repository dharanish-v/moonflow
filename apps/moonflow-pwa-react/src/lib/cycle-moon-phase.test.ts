import { describe, expect, it } from 'vitest';
import { computeCycleMoonPhase } from './cycle-moon-phase';

describe('computeCycleMoonPhase', () => {
  it('returns null with no period history at all', () => {
    const phase = computeCycleMoonPhase([], { avgCycleLength: 28, lastPeriodStart: null }, new Date(2026, 8, 6));
    expect(phase).toBeNull();
  });

  it('returns null when prediction confidence is wide (not enough regularity to place a phase)', () => {
    // Same wide-confidence scenario as home-status.test.ts's "unknown"
    // cyclePhase case (lengths 14 and 36 days apart, stdDev 11 > threshold 4).
    const phase = computeCycleMoonPhase(
      [
        { date: '2026-01-01', flow: 'medium' },
        { date: '2026-01-15', flow: 'medium' },
        { date: '2026-02-20', flow: 'medium' },
      ],
      { avgCycleLength: 28, lastPeriodStart: null },
      new Date(2026, 2, 1),
    );
    expect(phase).toBeNull();
  });

  it('places day 1 of a clean 28-day cycle at new moon (phase 0)', () => {
    const phase = computeCycleMoonPhase(
      [
        { date: '2026-01-01', flow: 'medium' },
        { date: '2026-01-29', flow: 'medium' },
      ],
      { avgCycleLength: 28, lastPeriodStart: null },
      new Date(2026, 0, 29),
    );
    expect(phase).toBeCloseTo(0);
  });

  it('places the predicted ovulation day at full moon (phase 0.5)', () => {
    // predicted next period = 2026-02-26 (28 days after 01-29); ovulation
    // day = 28 - LUTEAL_PHASE_DAYS(14) = day 14 = 2026-02-11.
    const phase = computeCycleMoonPhase(
      [
        { date: '2026-01-01', flow: 'medium' },
        { date: '2026-01-29', flow: 'medium' },
      ],
      { avgCycleLength: 28, lastPeriodStart: null },
      new Date(2026, 1, 11),
    );
    expect(phase).toBeCloseTo(0.5);
  });

  it('is monotonically increasing between new moon and full moon', () => {
    const settings = { avgCycleLength: 28, lastPeriodStart: null };
    const entries = [
      { date: '2026-01-01', flow: 'medium' as const },
      { date: '2026-01-29', flow: 'medium' as const },
    ];
    const day1 = computeCycleMoonPhase(entries, settings, new Date(2026, 0, 29));
    const day7 = computeCycleMoonPhase(entries, settings, new Date(2026, 1, 4));
    const day14 = computeCycleMoonPhase(entries, settings, new Date(2026, 1, 11));
    expect(day1).not.toBeNull();
    expect(day7).not.toBeNull();
    expect(day14).not.toBeNull();
    expect(day7 as number).toBeGreaterThan(day1 as number);
    expect(day14 as number).toBeGreaterThan(day7 as number);
  });

  it('continues past ovulation toward the next new moon (phase between 0.5 and 1)', () => {
    const phase = computeCycleMoonPhase(
      [
        { date: '2026-01-01', flow: 'medium' },
        { date: '2026-01-29', flow: 'medium' },
      ],
      { avgCycleLength: 28, lastPeriodStart: null },
      new Date(2026, 1, 18), // day 21 of 28, past the day-14 ovulation point
    );
    expect(phase).not.toBeNull();
    expect(phase as number).toBeGreaterThan(0.5);
    expect(phase as number).toBeLessThan(1);
  });
});
