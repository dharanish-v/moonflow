import { describe, expect, it } from 'vitest';
import type { Entry } from '../lib/types';
import { initialState, reducer } from './actions';

const e = (date: string, note = ''): Entry => ({ date, flow: 'medium', symptoms: [], mood: null, note, updatedAt: 1 });

describe('entry reducers', () => {
  it('UPSERT_ENTRY inserts in date order', () => {
    const s = reducer({ ...initialState, entries: [e('2026-09-01'), e('2026-09-10')] }, { type: 'UPSERT_ENTRY', entry: e('2026-09-05') });
    expect(s.entries.map((x) => x.date)).toEqual(['2026-09-01', '2026-09-05', '2026-09-10']);
  });

  it('UPSERT_ENTRY replaces an existing date instead of duplicating it', () => {
    const s = reducer({ ...initialState, entries: [e('2026-09-01', 'old')] }, { type: 'UPSERT_ENTRY', entry: e('2026-09-01', 'new') });
    expect(s.entries).toEqual([e('2026-09-01', 'new')]);
  });

  it('REMOVE_ENTRY drops only that date', () => {
    const s = reducer({ ...initialState, entries: [e('2026-09-01'), e('2026-09-02')] }, { type: 'REMOVE_ENTRY', date: '2026-09-01' });
    expect(s.entries.map((x) => x.date)).toEqual(['2026-09-02']);
  });
});

describe('day rollover (T59)', () => {
  it('DAY_CHANGED updates today', () => {
    const s = reducer({ ...initialState, today: '2026-09-26', calendarMonth: '2026-09' }, { type: 'DAY_CHANGED', today: '2026-09-27' });
    expect(s.today).toBe('2026-09-27');
    expect(s.calendarMonth).toBe('2026-09');
  });

  it('moves the calendar to the new month if it was showing the old current month', () => {
    const s = reducer({ ...initialState, today: '2026-09-30', calendarMonth: '2026-09' }, { type: 'DAY_CHANGED', today: '2026-10-01' });
    expect(s.calendarMonth).toBe('2026-10');
  });

  it('leaves the calendar alone if the user had browsed to another month', () => {
    const s = reducer({ ...initialState, today: '2026-09-30', calendarMonth: '2026-06' }, { type: 'DAY_CHANGED', today: '2026-10-01' });
    expect(s.calendarMonth).toBe('2026-06');
  });
});
