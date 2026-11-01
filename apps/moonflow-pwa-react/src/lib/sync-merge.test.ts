import { describe, expect, it } from 'vitest';
import { SETTINGS_DEFAULTS } from './db';
import type { Entry } from './types';
import { decideEntry, entryFromRemote, entryToRemote, pickSynced, settingsFromRemote, settingsToRemote, unionTags, type RemoteEntry } from './sync-merge';

const local = (updatedAt: number): Entry => ({ date: '2026-09-01', flow: 'light', symptoms: [], mood: null, note: '', updatedAt });

describe('decideEntry — newest updatedAt wins (ADR-054)', () => {
  it('takes the server copy when it is newer than the local day or tombstone', () => {
    expect(decideEntry({ updatedAt: 20 }, local(10), undefined)).toBe('take-remote');
    expect(decideEntry({ updatedAt: 20 }, undefined, { date: '2026-09-01', deletedAt: 10 })).toBe('take-remote');
    expect(decideEntry({ updatedAt: 1 }, undefined, undefined)).toBe('take-remote');
  });

  it('keeps the local day or deletion when it is newer', () => {
    expect(decideEntry({ updatedAt: 10 }, local(20), undefined)).toBe('keep-local');
    expect(decideEntry({ updatedAt: 10 }, undefined, { date: '2026-09-01', deletedAt: 20 })).toBe('keep-local');
  });

  it('treats a tie as already in agreement', () => {
    expect(decideEntry({ updatedAt: 10 }, local(10), undefined)).toBe('same');
  });
});

describe('mapping to and from the server', () => {
  it('round-trips a full day', () => {
    const day: Entry = {
      date: '2026-09-01', flow: 'heavy', symptoms: ['cramps'], mood: 'sad', note: 'n', tags: ['Pill'],
      temperature: 36.45, tempDisturbed: true, mucus: 'eggwhite', updatedAt: 5,
    };
    const remote = { ...entryToRemote(day), id: 'x', updated: '' } as RemoteEntry;
    expect(entryFromRemote(remote)).toEqual(day);
  });

  it('maps "not set" to the server’s zero values and back to null', () => {
    const empty: Entry = { date: '2026-09-02', flow: null, symptoms: [], mood: null, note: '', updatedAt: 1 };
    const remote = entryToRemote(empty);
    expect(remote).toMatchObject({ flow: '', mood: '', mucus: '', temperature: 0, tags: [], tempDisturbed: false, deleted: false });
    expect(entryFromRemote({ ...remote, id: 'x', updated: '' } as RemoteEntry)).toMatchObject({ flow: null, mood: null, mucus: null, temperature: null });
  });

  it('round-trips settings, including unset last period and birth year', () => {
    const s = pickSynced({ ...SETTINGS_DEFAULTS, customTags: ['a'], confirmedLongCycles: ['2026-01-01'], temperatureUnit: 'F' });
    const remote = { ...settingsToRemote(s, 9), id: 'r' };
    expect(remote).toMatchObject({ lastPeriodStart: '', birthYear: 0, updatedAt: 9 });
    expect(settingsFromRemote(remote)).toEqual(s);
  });

  it('never sends device-only settings', () => {
    const synced = pickSynced({ ...SETTINGS_DEFAULTS, pinHash: 'secret', themeMode: 'dark', account: { userId: 'u', email: 'e', token: 't' } });
    expect(Object.keys(synced)).not.toEqual(expect.arrayContaining(['pinHash']));
    expect(JSON.stringify(settingsToRemote(synced, 1))).not.toMatch(/secret|dark|token/);
  });
});

describe('unionTags', () => {
  it('keeps every tag from both sides, once, in a stable order', () => {
    expect(unionTags(['a', 'b'], ['b', 'c', 'a', 'd'])).toEqual(['a', 'b', 'c', 'd']);
    expect(unionTags([], ['x'])).toEqual(['x']);
  });
});
