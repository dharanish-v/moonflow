import { describe, expect, it } from 'vitest';
import { analyzeCycle, personalLutealLength } from './sympto-thermal';
import type { Entry, MucusId } from './types';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayOf = (start: string, n: number) => {
  const [y, m, d] = start.split('-').map(Number) as [number, number, number];
  return iso(new Date(y, m - 1, d + n - 1));
};
type Day = { temp?: number; mucus?: MucusId; disturbed?: boolean };
function cycle(start: string, days: Day[]): Entry[] {
  return days.map((x, i) => ({
    date: dayOf(start, i + 1),
    flow: i < 4 ? 'medium' : null,
    symptoms: [],
    mood: null,
    note: '',
    updatedAt: 0,
    temperature: x.temp ?? null,
    mucus: x.mucus ?? null,
    tempDisturbed: x.disturbed ?? false,
  }));
}

// Days 1–12 low (36.30–36.45), then a clear rise.
const LOW = [36.3, 36.35, 36.4, 36.3, 36.35, 36.4, 36.45, 36.35, 36.4, 36.3, 36.4, 36.35];
const base = (extra: Day[]): Day[] =>
  LOW.map((temp, i): Day => ({ temp, mucus: i === 10 || i === 11 ? 'eggwhite' : i > 7 ? 'creamy' : 'dry' })).concat(extra);

describe('analyzeCycle — temperature shift (Sensiplan rules)', () => {
  it('confirms a shift on the 3rd higher reading ≥0.2°C above the coverline', () => {
    const entries = cycle('2026-03-01', base([{ temp: 36.6, mucus: 'creamy' }, { temp: 36.62 }, { temp: 36.7 }, { temp: 36.7 }, { temp: 36.72 }]));
    const a = analyzeCycle(entries, '2026-03-01');
    expect(a.coverline).toBe(36.45); // highest of the 6 lows before the first higher reading
    expect(a.firstHigherDate).toBe('2026-03-13');
    expect(a.tempShiftDate).toBe('2026-03-15');
  });

  it('accepts a 4th higher reading when the 3rd is not 0.2°C above (exception 1)', () => {
    const entries = cycle('2026-03-01', base([{ temp: 36.5 }, { temp: 36.55 }, { temp: 36.6 }, { temp: 36.5 }]));
    expect(analyzeCycle(entries, '2026-03-01').tempShiftDate).toBe('2026-03-16');
  });

  it('ignores disturbed readings', () => {
    const entries = cycle('2026-03-01', base([{ temp: 37.2, disturbed: true }, { temp: 36.6 }, { temp: 36.62 }, { temp: 36.7 }]));
    const a = analyzeCycle(entries, '2026-03-01');
    expect(a.firstHigherDate).toBe('2026-03-14');
    expect(a.tempShiftDate).toBe('2026-03-16');
  });

  it('finds no shift without 6 valid low readings first', () => {
    const entries = cycle('2026-03-01', [{ temp: 36.3 }, { temp: 36.4 }, { temp: 36.8 }, { temp: 36.8 }, { temp: 36.9 }]);
    expect(analyzeCycle(entries, '2026-03-01').tempShiftDate).toBeNull();
  });
});

describe('analyzeCycle — mucus peak and confirmation', () => {
  it('peak = last day of the best mucus, confirmed on the 3rd day after it', () => {
    const entries = cycle('2026-03-01', base([{ temp: 36.6, mucus: 'creamy' }, { temp: 36.62, mucus: 'sticky' }, { temp: 36.7, mucus: 'dry' }]));
    const a = analyzeCycle(entries, '2026-03-01');
    expect(a.mucusPeakDate).toBe('2026-03-12');
    expect(a.mucusConfirmedDate).toBe('2026-03-15');
  });

  it('ovulation is confirmed only when both signs are complete, on the later of the two', () => {
    const entries = cycle('2026-03-01', base([{ temp: 36.6, mucus: 'creamy' }, { temp: 36.62 }, { temp: 36.7 }]));
    const a = analyzeCycle(entries, '2026-03-01');
    expect(a.ovulationConfirmed).toBe(true);
    expect(a.infertileFrom).toBe('2026-03-15');
    expect(a.ovulationEstimate).toBe('2026-03-12');

    const tempOnly = cycle('2026-03-01', LOW.map((temp) => ({ temp })).concat([{ temp: 36.6 }, { temp: 36.62 }, { temp: 36.7 }]));
    expect(analyzeCycle(tempOnly, '2026-03-01').ovulationConfirmed).toBe(false);
  });
});

describe('personalLutealLength', () => {
  it('learns the luteal length from confirmed ovulations, clamped to 10–16 days', () => {
    const c1 = cycle('2026-03-01', base([{ temp: 36.6, mucus: 'creamy' }, { temp: 36.62 }, { temp: 36.7 }]));
    const c2 = cycle('2026-03-27', base([{ temp: 36.6, mucus: 'creamy' }, { temp: 36.62 }, { temp: 36.7 }]));
    const next = cycle('2026-04-22', [{}]);
    // ovulation 12 Mar → next period 27 Mar = 15 days; 7 Apr → 22 Apr = 15 days
    expect(personalLutealLength([...c1, ...c2, ...next])).toBe(15);
    expect(personalLutealLength(c1)).toBeNull(); // no following period yet
  });
});

describe('forecast uses the personal luteal length (E9)', () => {
  it('places ovulation by your measured luteal phase instead of the default 13 days', async () => {
    const { computeForecast } = await import('./forecast');
    const c1 = cycle('2026-03-01', base([{ temp: 36.6, mucus: 'creamy' }, { temp: 36.62 }, { temp: 36.7 }]));
    const c2 = cycle('2026-03-27', base([{ temp: 36.6, mucus: 'creamy' }, { temp: 36.62 }, { temp: 36.7 }]));
    const next = cycle('2026-04-22', [{}, {}, {}, {}]);
    const f = computeForecast([...c1, ...c2, ...next], { lastPeriodStart: null, avgCycleLength: 28, avgPeriodLength: 5 }, new Date(2026, 3, 30));
    expect(f.lutealLength).toBe(15);
    expect(f.lutealSource).toBe('personal');
    expect(f.fertile?.peak).toBe(addDaysForTest(f.next!.date, -15));
  });
});

function addDaysForTest(d: string, n: number) {
  const [y, m, dd] = d.split('-').map(Number) as [number, number, number];
  const x = new Date(y, m - 1, dd + n);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
