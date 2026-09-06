import { describe, expect, it } from 'vitest';
import { computeHomeStatus } from './home-status';

describe('computeHomeStatus', () => {
  it('reports "on your period" while today falls inside the most recent logged period', () => {
    const status = computeHomeStatus(
      [
        { date: '2026-09-01', flow: 'medium' },
        { date: '2026-09-02', flow: 'medium' },
      ],
      { avgCycleLength: 28, lastPeriodStart: null },
      new Date(2026, 8, 2),
    );
    expect(status.statusText).toBe('on your period');
    expect(status.cycleDay).toBe(2);
    expect(status.cyclePhase).toBe('period');
    expect(status.isEstimated).toBe(false);
  });

  it('reports days-to-next-period once a prediction is confirmed', () => {
    const status = computeHomeStatus(
      [
        { date: '2026-06-01', flow: 'medium' },
        { date: '2026-06-29', flow: 'medium' },
        { date: '2026-07-27', flow: 'medium' },
      ],
      { avgCycleLength: 28, lastPeriodStart: null },
      new Date(2026, 7, 20),
    );
    expect(status.statusText).toMatch(/day.*to next period/);
    expect(status.isEstimated).toBe(false);
    expect(status.cyclePhase).toBe('luteal');
  });

  it('reports the follicular phase between a period ending and the fertile window opening', () => {
    const status = computeHomeStatus(
      [
        { date: '2026-01-01', flow: 'medium' },
        { date: '2026-01-29', flow: 'medium' },
      ],
      { avgCycleLength: 28, lastPeriodStart: null },
      new Date(2026, 1, 1),
    );
    expect(status.isFertile).toBe(false);
    expect(status.cyclePhase).toBe('follicular');
  });

  it('reports the unknown cycle phase when predictions are too wide to place a phase', () => {
    const status = computeHomeStatus(
      [
        { date: '2026-01-01', flow: 'medium' },
        { date: '2026-01-15', flow: 'medium' },
        { date: '2026-02-20', flow: 'medium' },
      ],
      { avgCycleLength: 28, lastPeriodStart: null },
      new Date(2026, 2, 1),
    );
    expect(status.statusText).toBe('predictions need a bit more history');
    expect(status.cyclePhase).toBe('unknown');
  });

  it('falls back to an estimate from the onboarding date with no logged periods yet', () => {
    const status = computeHomeStatus(
      [],
      { avgCycleLength: 28, lastPeriodStart: '2026-08-10' },
      new Date(2026, 8, 6),
    );
    expect(status.cycleDay).toBe(28); // Aug 10 -> Sep 6 is 27 elapsed days, +1 for cycle day 1
    expect(status.isEstimated).toBe(true);
  });

  it('flags the fertile window when today falls inside it', () => {
    // Predicted next period 2026-09-29 (median cycle 28 from two prior periods),
    // fertile peak 14 days before = 2026-09-15, window 09-10..09-16.
    const status = computeHomeStatus(
      [
        { date: '2026-08-03', flow: 'medium' },
        { date: '2026-08-31', flow: 'medium' },
      ],
      { avgCycleLength: 28, lastPeriodStart: null },
      new Date(2026, 8, 15),
    );
    expect(status.isFertile).toBe(true);
    expect(status.statusText).toBe('fertile window');
  });
});
