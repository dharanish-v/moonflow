import { describe, expect, it } from 'vitest';
import { healthNudges } from './health-nudges';
import type { Entry, FlowId } from './types';

const BASE = { lastPeriodStart: null, avgCycleLength: 28, avgPeriodLength: 5 };
const dayStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function periods(starts: string[], len = 4, flow: FlowId = 'medium'): Array<Pick<Entry, 'date' | 'flow'>> {
  return starts.flatMap((s) => {
    const [y, m, d] = s.split('-').map(Number) as [number, number, number];
    return Array.from({ length: len }, (_, i) => ({ date: dayStr(new Date(y, m - 1, d + i)), flow }));
  });
}
const ids = (n: ReturnType<typeof healthNudges>) => n.map((x) => x.id);

describe('healthNudges (FIGO 2018 criteria)', () => {
  it('stays quiet for regular, normal cycles', () => {
    const e = periods(['2026-03-01', '2026-03-29', '2026-04-26', '2026-05-24', '2026-06-21']);
    expect(healthNudges(e, BASE, new Date(2026, 6, 1))).toEqual([]);
  });

  it('flags cycles often outside 24–38 days', () => {
    const e = periods(['2026-01-01', '2026-01-21', '2026-02-10', '2026-03-02']); // 20-day cycles
    expect(ids(healthNudges(e, BASE, new Date(2026, 2, 10)))).toContain('cycle-length');
  });

  it('flags irregular cycles (shortest-to-longest spread ≥ 8 days)', () => {
    const e = periods(['2026-01-01', '2026-01-25', '2026-03-02', '2026-03-28']); // 24, 36, 26
    expect(ids(healthNudges(e, BASE, new Date(2026, 3, 1)))).toContain('irregular');
  });

  it('flags a period lasting more than 8 days', () => {
    const e = periods(['2026-05-01'], 10);
    expect(ids(healthNudges(e, BASE, new Date(2026, 4, 20)))).toContain('long-period');
  });

  it('flags bleeding between periods in two or more cycles', () => {
    const e = [
      ...periods(['2026-03-01', '2026-03-29', '2026-04-26']),
      { date: '2026-03-15', flow: 'spotting' as const },
      { date: '2026-04-12', flow: 'spotting' as const },
    ];
    expect(ids(healthNudges(e, BASE, new Date(2026, 4, 1)))).toContain('intermenstrual');
  });

  it('flags 90 days without a period', () => {
    const e = periods(['2026-01-01']);
    expect(ids(healthNudges(e, BASE, new Date(2026, 3, 5)))).toContain('no-period-90');
  });

  it('every nudge is calm, says it is not a diagnosis, and points to a clinician', () => {
    const e = periods(['2026-05-01'], 10);
    for (const n of healthNudges(e, BASE, new Date(2026, 4, 20))) {
      expect(n.body).toMatch(/not a diagnosis/i);
      expect(n.body).toMatch(/clinician|doctor/i);
      expect(n.title).not.toMatch(/!|warning|danger/i);
    }
  });

  it('stays silent while predictions are paused', () => {
    const e = periods(['2026-01-01']);
    expect(healthNudges(e, { ...BASE, predictionsPaused: true }, new Date(2026, 3, 5))).toEqual([]);
  });
});

describe('healthNudges — perimenopause mode (T91)', () => {
  it('stops flagging irregularity (expected in the transition) but keeps the red flags', () => {
    const e = [
      ...periods(['2026-01-01', '2026-01-25', '2026-03-02', '2026-03-28']), // irregular
      ...periods(['2026-05-01'], 10), // long period
    ];
    const on = healthNudges(e, { ...BASE, perimenopauseMode: true }, new Date(2026, 4, 20)).map((n) => n.id);
    expect(on).not.toContain('irregular');
    expect(on).toContain('long-period');
  });

  it('always flags bleeding after 12 months without a period', () => {
    const e = [...periods(['2025-01-10']), { date: '2026-03-02', flow: 'spotting' as const }];
    expect(healthNudges(e, BASE, new Date(2026, 2, 5)).map((n) => n.id)).toContain('postmenopausal-bleeding');
  });
});
