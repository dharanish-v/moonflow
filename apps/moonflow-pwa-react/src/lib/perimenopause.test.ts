import { describe, expect, it } from 'vitest';
import { menopauseNudges, perimenopauseStage, suggestPerimenopauseMode } from './perimenopause';
import type { Entry } from './types';

const p = (date: string): Pick<Entry, 'date' | 'flow'> => ({ date, flow: 'medium' });
const regular = ['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26', '2026-04-23'].map(p);

describe('perimenopauseStage (STRAW+10)', () => {
  it('is null for regular cycles', () => {
    expect(perimenopauseStage(regular, new Date(2026, 4, 1))).toBeNull();
  });

  it('early transition: consecutive cycles differing by 7+ days, recurring', () => {
    // 28, 20, 34, 24 → diffs 8, 14, 10
    const e = ['2026-01-01', '2026-01-29', '2026-02-18', '2026-03-24', '2026-04-17'].map(p);
    expect(perimenopauseStage(e, new Date(2026, 4, 1))).toBe('early-transition');
  });

  it('late transition: a gap of 60+ days between periods', () => {
    const e = ['2026-01-01', '2026-01-29', '2026-04-10', '2026-05-08'].map(p);
    expect(perimenopauseStage(e, new Date(2026, 4, 20))).toBe('late-transition');
  });

  it('possibly postmenopausal: 12 months without a period', () => {
    expect(perimenopauseStage([p('2025-03-01')], new Date(2026, 3, 1))).toBe('postmenopause-possible');
  });
});

describe('suggestPerimenopauseMode', () => {
  const late = ['2026-01-01', '2026-01-29', '2026-04-10', '2026-05-08'].map(p);
  it('suggests the mode only at 40+ with a matching pattern, and not once it is on', () => {
    expect(suggestPerimenopauseMode(late, { birthYear: 1980, perimenopauseMode: false }, new Date(2026, 4, 20))).toBe(true);
    expect(suggestPerimenopauseMode(late, { birthYear: 1995, perimenopauseMode: false }, new Date(2026, 4, 20))).toBe(false);
    expect(suggestPerimenopauseMode(late, { birthYear: null, perimenopauseMode: false }, new Date(2026, 4, 20))).toBe(false);
    expect(suggestPerimenopauseMode(late, { birthYear: 1980, perimenopauseMode: true }, new Date(2026, 4, 20))).toBe(false);
  });
});

describe('menopauseNudges', () => {
  it('flags any bleeding after 12 months without a period — the one sign to check', () => {
    const e = [p('2025-01-10'), { date: '2026-03-02', flow: 'spotting' as const }];
    const n = menopauseNudges(e, new Date(2026, 2, 5));
    expect(n.map((x) => x.id)).toContain('postmenopausal-bleeding');
    expect(n[0]!.body).toMatch(/clinician|doctor/i);
  });

  it('stays quiet without such bleeding', () => {
    expect(menopauseNudges(regular, new Date(2026, 4, 1))).toEqual([]);
  });
});
