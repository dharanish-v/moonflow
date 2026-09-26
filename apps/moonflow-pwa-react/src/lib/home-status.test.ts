import { describe, expect, it } from 'vitest';
import { computeHomeStatus } from './home-status';
import type { Entry, Settings } from './types';

type S = Pick<Settings, 'avgCycleLength' | 'avgPeriodLength' | 'lastPeriodStart'>;
const BASE: S = { avgCycleLength: 28, avgPeriodLength: 5, lastPeriodStart: null };
const med = (date: string): Pick<Entry, 'date' | 'flow'> => ({ date, flow: 'medium' });

// Three single-day periods 28 days apart → 2 valid cycles → confirmed.
const REGULAR = [med('2026-06-01'), med('2026-06-29'), med('2026-07-27')]; // next: 2026-08-24

describe('computeHomeStatus', () => {
  it('never crashes with no start date and no periods — shows a welcome instead', () => {
    const status = computeHomeStatus([], BASE, new Date(2026, 8, 25));
    expect(status.headline).toBe('Welcome');
    expect(status.cyclePhase).toBe('unknown');
    expect(status.ring).toBeNull();
    expect(status.detail).toBeNull();
  });

  it('reports the period day while today falls inside the latest logged period', () => {
    const status = computeHomeStatus([med('2026-09-01'), med('2026-09-02')], BASE, new Date(2026, 8, 2));
    expect(status.cycleDay).toBe(2);
    expect(status.cyclePhase).toBe('period');
    expect(status.isEstimated).toBe(false);
    expect(status.headline).toBe('Day 2');
    expect(status.caption).toBe('of your period');
  });

  it('counts down to a confirmed prediction and always shows the expected range', () => {
    const status = computeHomeStatus(REGULAR, BASE, new Date(2026, 7, 16));
    expect(status.isEstimated).toBe(false);
    expect(status.cyclePhase).toBe('luteal');
    expect(status.headline).toBe('8 days');
    expect(status.caption).toBe('to your next period');
    expect(status.detail).toBe('Expected 22–26 Aug');
  });

  it('sizes the ring to one predicted cycle without wrapping', () => {
    const status = computeHomeStatus(REGULAR, BASE, new Date(2026, 7, 20));
    expect(status.ring!.totalDays).toBe(28);
    expect(status.ring!.todayAngle).toBeCloseTo((24 / 28) * 360, 1);
    expect(status.ring!.periodEndAngle).toBeCloseTo((1 / 28) * 360, 1);
    // range 22–26 Aug → fertile 4–14 Aug (same window the phase uses) = 8 and 18 days in
    expect(status.ring!.fertileStartAngle).toBeCloseTo((8 / 28) * 360, 1);
    expect(status.ring!.fertileEndAngle).toBeCloseTo((18 / 28) * 360, 1);
  });

  it('reports the follicular phase before the fertile window opens', () => {
    const status = computeHomeStatus(REGULAR, BASE, new Date(2026, 6, 31));
    expect(status.cyclePhase).toBe('follicular');
  });

  it('flags the fertile window as an estimate', () => {
    const status = computeHomeStatus(REGULAR, BASE, new Date(2026, 7, 9));
    expect(status.cyclePhase).toBe('fertile');
    expect(status.headline).toMatch(/^(\d+ days? left|Last day)$/);
    expect(status.caption).toBe('in your fertile window');
    expect(status.detail).toMatch(/not birth control/i);
  });

  it('shows "Today" on the predicted date', () => {
    const status = computeHomeStatus(REGULAR, BASE, new Date(2026, 7, 24));
    expect(status.headline).toBe('Today');
    expect(status.caption).toBe('your period may start today');
  });

  it('shows "late · N days" past the predicted range — never "any day now" forever', () => {
    const status = computeHomeStatus(REGULAR, BASE, new Date(2026, 8, 10));
    expect(status.headline).toBe('17 days late');
    expect(status.caption).toBe('log your period when it starts');
    expect(status.isLate).toBe(true);
  });

  it('uses the onboarding date with no logged periods, and says so', () => {
    const status = computeHomeStatus([], { ...BASE, lastPeriodStart: '2026-08-10' }, new Date(2026, 8, 1));
    expect(status.cycleDay).toBe(23);
    expect(status.isEstimated).toBe(true);
    expect(status.estimateNote).toMatch(/date you entered during setup/);
  });

  it('explains an estimate based on one logged cycle differently from a setup-date estimate', () => {
    const status = computeHomeStatus([med('2026-06-01'), med('2026-06-29')], BASE, new Date(2026, 6, 10));
    expect(status.isEstimated).toBe(true);
    expect(status.estimateNote).toMatch(/one logged cycle/);
  });

  it('marks irregular cycles in the detail line', () => {
    const status = computeHomeStatus(
      [med('2026-03-01'), med('2026-03-25'), med('2026-05-01'), med('2026-05-27')],
      BASE,
      new Date(2026, 5, 15), // after the fertile window, before the range
    );
    expect(status.detail).toMatch(/^Expected 19–25 Jun · cycles vary$/);
  });
});

describe('computeHomeStatus — paused (T65)', () => {
  it('shows no countdown, fertile window or range while predictions are paused', () => {
    const status = computeHomeStatus(REGULAR, { ...BASE, predictionsPaused: true }, new Date(2026, 7, 9));
    expect(status.headline).toBe('Predictions paused');
    expect(status.cyclePhase).toBe('unknown');
    expect(status.detail).toBeNull();
    expect(status.ring).toBeNull();
    expect(status.isEstimated).toBe(false);
  });
});
