import { describe, expect, it } from 'vitest';
import { computeForecast } from './forecast';
import type { Entry, FlowId, Settings } from './types';

type S = Pick<Settings, 'lastPeriodStart' | 'avgCycleLength' | 'avgPeriodLength'>;
const SETTINGS: S = { lastPeriodStart: null, avgCycleLength: 28, avgPeriodLength: 5 };

/** Builds a period of `days` medium-flow entries starting at `start`. */
function period(start: string, days = 4, flow: FlowId = 'medium'): Array<Pick<Entry, 'date' | 'flow'>> {
  const [y, m, d] = start.split('-').map(Number) as [number, number, number];
  return Array.from({ length: days }, (_, i) => {
    const dt = new Date(y, m - 1, d + i);
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    return { date: iso, flow };
  });
}

const day = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
};

describe('computeForecast — no data', () => {
  it('returns a "none" forecast instead of crashing when there is no start date and no periods', () => {
    const f = computeForecast([], SETTINGS, day('2026-09-25'));
    expect(f.status).toBe('none');
    expect(f.next).toBeNull();
    expect(f.fertile).toBeNull();
    expect(f.cycleDay).toBeNull();
  });

  it('spotting-only history with no start date is still "none", not a crash', () => {
    const f = computeForecast([{ date: '2026-09-01', flow: 'spotting' }], SETTINGS, day('2026-09-25'));
    expect(f.status).toBe('none');
  });
});

describe('computeForecast — estimates before real history', () => {
  it('uses the onboarding date + average cycle, labelled estimated, always with a range', () => {
    const f = computeForecast([], { ...SETTINGS, lastPeriodStart: '2026-09-10' }, day('2026-09-15'));
    expect(f.status).toBe('upcoming');
    expect(f.next?.date).toBe('2026-10-08');
    expect(f.next?.confidence).toBe('estimated');
    expect(f.next!.rangeStart < f.next!.date).toBe(true);
    expect(f.next!.rangeEnd > f.next!.date).toBe(true);
    expect(f.cycleDay).toBe(6);
  });

  it('keeps the onboarding start as a cycle anchor once real periods are logged after it', () => {
    const f = computeForecast(period('2026-10-08'), { ...SETTINGS, lastPeriodStart: '2026-09-10' }, day('2026-10-20'));
    expect(f.cycleLengths).toEqual([28]);
  });

  it('a single cycle is never "confirmed"', () => {
    const f = computeForecast([...period('2026-08-01'), ...period('2026-08-29')], SETTINGS, day('2026-09-05'));
    expect(f.next?.confidence).toBe('estimated');
  });
});

describe('computeForecast — confirmed predictions', () => {
  const regular = [...period('2026-05-01'), ...period('2026-05-29'), ...period('2026-06-26'), ...period('2026-07-24')];

  it('confirms with 2+ valid cycles and predicts from the median', () => {
    const f = computeForecast(regular, SETTINGS, day('2026-08-01'));
    expect(f.next?.confidence).toBe('confirmed');
    expect(f.next?.date).toBe('2026-08-21');
    expect(f.irregular).toBe(false);
  });

  it('rounds an even-count median to a whole day (no silent truncation)', () => {
    const f = computeForecast([...period('2026-06-01'), ...period('2026-06-29'), ...period('2026-07-28')], SETTINGS, day('2026-08-01'));
    // cycles 28 + 29 → median 28.5 → 29
    expect(f.next?.date).toBe('2026-08-26');
  });

  it('uses only the most recent 6 valid cycles', () => {
    // six old 40-day cycles, then six recent 28-day cycles
    const starts: string[] = [];
    let d = day('2025-01-01');
    for (let i = 0; i < 7; i++) {
      starts.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 40);
    }
    for (let i = 0; i < 6; i++) {
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 40 + 28);
      starts.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 40);
    }
    const entries = starts.flatMap((s) => period(s, 3));
    const f = computeForecast(entries, SETTINGS, day(starts.at(-1)!));
    expect(f.cycleLengths.slice(-6).every((n) => n === 28)).toBe(true);
    expect(f.usedCycleLengths).toEqual([28, 28, 28, 28, 28, 28]);
  });

  it('drops impossible cycles shorter than 15 days (two logs 5 days apart are not two cycles)', () => {
    const f = computeForecast([...period('2026-09-20', 1, 'light'), ...period('2026-09-25', 1, 'medium')], SETTINGS, day('2026-09-26'));
    expect(f.next?.confidence).toBe('estimated');
    expect(f.usedCycleLengths).toEqual([]);
  });

  it('excludes a likely missed-log cycle (≥1.6× the median) from the prediction', () => {
    // 28, 28, 56 (one period never logged), 28
    const f = computeForecast(
      [...period('2026-01-01'), ...period('2026-01-29'), ...period('2026-02-26'), ...period('2026-04-23'), ...period('2026-05-21')],
      SETTINGS,
      day('2026-05-25'),
    );
    expect(f.suspectedMissedCycles).toEqual([{ start: '2026-02-26', length: 56 }]);
    expect(f.usedCycleLengths).toEqual([28, 28, 28]);
    expect(f.next?.date).toBe('2026-06-18');
  });

  it('flags irregular history (spread ≥ 8 days) and widens the range to cover it', () => {
    const f = computeForecast([...period('2026-03-01'), ...period('2026-03-25'), ...period('2026-05-01'), ...period('2026-05-27')], SETTINGS, day('2026-06-01'));
    // cycles 24, 37, 26 → spread 13
    expect(f.irregular).toBe(true);
    expect(f.next?.rangeStart).toBe('2026-06-20'); // 27 May + 24
    expect(f.next?.rangeEnd).toBe('2026-07-03'); // 27 May + 37
  });
});

describe('computeForecast — status over the cycle', () => {
  const regular = [...period('2026-05-01'), ...period('2026-05-29'), ...period('2026-06-26'), ...period('2026-07-24')];

  it('is on-period while today is inside the latest logged period', () => {
    const f = computeForecast(regular, SETTINGS, day('2026-07-25'));
    expect(f.status).toBe('on-period');
    expect(f.cycleDay).toBe(2);
    expect(f.fertile).not.toBeNull(); // this cycle's upcoming window
  });

  it('is due inside the predicted range', () => {
    const f = computeForecast(regular, SETTINGS, day('2026-08-21'));
    expect(f.status).toBe('due');
  });

  it('is late — with a day count, not "any day now" forever — once past the range', () => {
    const f = computeForecast(regular, SETTINGS, day('2026-09-10'));
    expect(f.status).toBe('late');
    expect(f.daysLate).toBe(20);
    expect(f.fertile).toBeNull();
  });

  it('places ovulation 13 days before the predicted period, fertile window −5/+1 widened by the range', () => {
    const f = computeForecast(regular, SETTINGS, day('2026-08-01'));
    expect(f.fertile?.peak).toBe('2026-08-08');
    expect(f.fertile!.start <= '2026-08-03').toBe(true);
    expect(f.fertile!.end >= '2026-08-09').toBe(true);
  });

  it('predicts period length as the median of recent logged periods, falling back to the setting', () => {
    expect(computeForecast(regular, SETTINGS, day('2026-08-01')).periodLength).toBe(4);
    expect(computeForecast([], { ...SETTINGS, lastPeriodStart: '2026-09-10' }, day('2026-09-15')).periodLength).toBe(5);
  });
});
