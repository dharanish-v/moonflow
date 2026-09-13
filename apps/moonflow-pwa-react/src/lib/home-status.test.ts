import { describe, expect, it } from 'vitest';
import { computeHomeStatus } from './home-status';

describe('computeHomeStatus', () => {
  it('reports "on your period" while today falls inside the most recent logged period', () => {
    const status = computeHomeStatus(
      [
        { date: '2026-09-01', flow: 'medium' },
        { date: '2026-09-02', flow: 'medium' },
      ],
      { avgCycleLength: 28, avgPeriodLength: 5, lastPeriodStart: null },
      new Date(2026, 8, 2),
    );
    expect(status.statusText).toBe('on your period');
    expect(status.cycleDay).toBe(2);
    expect(status.cyclePhase).toBe('period');
    expect(status.isEstimated).toBe(false);
    expect(status.headline).toBe('Day 2');
    expect(status.caption).toBe('of your period');
  });

  it('reports days-to-next-period once a prediction is confirmed', () => {
    const status = computeHomeStatus(
      [
        { date: '2026-06-01', flow: 'medium' },
        { date: '2026-06-29', flow: 'medium' },
        { date: '2026-07-27', flow: 'medium' },
      ],
      { avgCycleLength: 28, avgPeriodLength: 5, lastPeriodStart: null },
      new Date(2026, 7, 20),
    );
    expect(status.statusText).toMatch(/day.*to next period/);
    expect(status.isEstimated).toBe(false);
    expect(status.cyclePhase).toBe('luteal');
    expect(status.headline).toMatch(/^\d+ days?$/);
    expect(status.caption).toBe('to your next period');

    // One real logged period (2026-07-27, single day) -> mostRecentStart;
    // median gap 28 days -> predicted 2026-08-24 -> totalDays 28. Ovulation
    // 14 days before (LUTEAL_PHASE_DAYS) = 2026-08-10, fertile window
    // 2026-08-05..2026-08-11 (5 before/1 after). Today 2026-08-20 is 24
    // days into the cycle.
    expect(status.ring).not.toBeNull();
    expect(status.ring!.totalDays).toBe(28);
    expect(status.ring!.todayAngle).toBeCloseTo((24 / 28) * 360, 1);
    expect(status.ring!.periodEndAngle).toBeCloseTo((1 / 28) * 360, 1); // 1-day logged period
    expect(status.ring!.fertileStartAngle).toBeCloseTo((9 / 28) * 360, 1);
    expect(status.ring!.fertileEndAngle).toBeCloseTo((15 / 28) * 360, 1);
  });

  it('reports the follicular phase between a period ending and the fertile window opening', () => {
    const status = computeHomeStatus(
      [
        { date: '2026-01-01', flow: 'medium' },
        { date: '2026-01-29', flow: 'medium' },
      ],
      { avgCycleLength: 28, avgPeriodLength: 5, lastPeriodStart: null },
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
      { avgCycleLength: 28, avgPeriodLength: 5, lastPeriodStart: null },
      new Date(2026, 2, 1),
    );
    expect(status.statusText).toBe('predictions need a bit more history');
    expect(status.cyclePhase).toBe('unknown');
    // Real logged history exists (just too irregular to predict confidently)
    // — headline still shows the real cycle day, not a "new user" welcome.
    expect(status.headline).toBe(`Day ${status.cycleDay}`);
    // No confident predicted date -> no lap length to size a ring against.
    expect(status.ring).toBeNull();
  });

  it('falls back to an estimate from the onboarding date with no logged periods yet', () => {
    const status = computeHomeStatus(
      [],
      { avgCycleLength: 28, avgPeriodLength: 5, lastPeriodStart: '2026-08-10' },
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
      { avgCycleLength: 28, avgPeriodLength: 5, lastPeriodStart: null },
      new Date(2026, 8, 15),
    );
    expect(status.isFertile).toBe(true);
    expect(status.statusText).toBe('fertile window');
    expect(status.headline).toMatch(/^(\d+ days? left|Last day)$/);
    expect(status.caption).toBe('in your fertile window');
  });

  it('shows "Today" when the predicted period starts today', () => {
    const status = computeHomeStatus(
      [
        { date: '2026-06-01', flow: 'medium' },
        { date: '2026-06-29', flow: 'medium' },
      ],
      { avgCycleLength: 28, avgPeriodLength: 5, lastPeriodStart: null },
      new Date(2026, 6, 27), // 28 days after 2026-06-29 = 2026-07-27
    );
    expect(status.headline).toBe('Today');
    expect(status.caption).toBe('your period may start today');
  });

  it('shows "Any day now" once the predicted date has passed with no period logged', () => {
    const status = computeHomeStatus(
      [
        { date: '2026-06-01', flow: 'medium' },
        { date: '2026-06-29', flow: 'medium' },
      ],
      { avgCycleLength: 28, avgPeriodLength: 5, lastPeriodStart: null },
      new Date(2026, 6, 30), // well past the 2026-07-27 prediction
    );
    expect(status.headline).toBe('Any day now');
    expect(status.caption).toBe('your period may be starting soon');
  });
});
