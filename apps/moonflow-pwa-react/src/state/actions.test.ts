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
