// T99 (ADR-054) — every local write queues what sync must send, in the same
// transaction as the write itself.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  db,
  deleteEntry,
  deleteEntryAndClearDraft,
  eraseAllData,
  importData,
  markPeriodDays,
  restoreDays,
  saveEntry,
  saveEntryAndClearDraft,
  saveSettings,
  setSetting,
} from './db';
import { subscribeLocalChange } from './sync-signal';

const day = (date: string) => ({ date, flow: 'medium' as const, symptoms: [], mood: null, note: '' });
const outbox = async () => (await db.outbox.toArray()).map((r) => r.key).sort();

beforeEach(async () => {
  for (const t of [db.entries, db.settings, db.tombstones, db.outbox, db.syncState]) await t.clear();
});

describe('sync bookkeeping', () => {
  it('queues a saved day and tells sync', async () => {
    const heard = vi.fn();
    const off = subscribeLocalChange(heard);
    await saveEntry(day('2026-09-01'));
    await saveEntryAndClearDraft(day('2026-09-02'));
    off();
    expect(await outbox()).toEqual(['entry:2026-09-01', 'entry:2026-09-02']);
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it('leaves a tombstone for a deleted day, and removes it when the day is saved again', async () => {
    await saveEntry(day('2026-09-01'));
    await deleteEntry('2026-09-01');
    await deleteEntryAndClearDraft('2026-09-02');
    expect((await db.tombstones.toArray()).map((t) => t.date).sort()).toEqual(['2026-09-01', '2026-09-02']);
    await saveEntry(day('2026-09-01'));
    expect(await db.tombstones.get('2026-09-01')).toBeUndefined();
    expect(await outbox()).toEqual(['entry:2026-09-01', 'entry:2026-09-02']);
  });

  it('queues every day marked as a period', async () => {
    await markPeriodDays(['2026-09-01', '2026-09-02', '2026-09-03']);
    expect(await outbox()).toEqual(['entry:2026-09-01', 'entry:2026-09-02', 'entry:2026-09-03']);
  });

  it('gives undone days a fresh stamp so the undo survives the next sync', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1000);
    await saveEntry(day('2026-09-01'));
    const previous = [await db.entries.get('2026-09-01'), undefined];
    vi.setSystemTime(2000);
    await markPeriodDays(['2026-09-01', '2026-09-02']);
    vi.setSystemTime(3000);
    await restoreDays(['2026-09-01', '2026-09-02'], previous);
    vi.useRealTimers();
    expect((await db.entries.get('2026-09-01'))!.updatedAt).toBe(3000);
    expect(await db.entries.get('2026-09-02')).toBeUndefined();
    expect(await db.tombstones.get('2026-09-02')).toEqual({ date: '2026-09-02', deletedAt: 3000 });
  });

  it('stamps imported days fresh so a restore wins, and queues its settings', async () => {
    await importData([{ ...day('2026-01-01'), updatedAt: 5 }], { lastPeriodStart: '2026-01-01', avgCycleLength: 30, avgPeriodLength: 5 });
    expect((await db.entries.get('2026-01-01'))!.updatedAt).toBeGreaterThan(5);
    expect(await outbox()).toEqual(['entry:2026-01-01', 'settings']);
    expect((await db.syncState.get('settingsChangedAt'))!.value).toEqual(expect.any(Number));
  });

  it('queues settings that describe the person, never device-only ones', async () => {
    await saveSettings({ themeMode: 'dark', pinLockEnabled: true, account: { userId: 'u', email: 'e', token: 't' } });
    await setSetting('draftEntry', null);
    expect(await outbox()).toEqual([]);
    await setSetting('fertilityAwareness', true);
    expect(await outbox()).toEqual(['settings']);
  });

  it('erase clears the bookkeeping too', async () => {
    await saveEntry(day('2026-09-01'));
    await deleteEntry('2026-09-02');
    await db.syncState.put({ key: 'cursor', value: 'x' });
    await eraseAllData();
    expect(await db.outbox.count()).toBe(0);
    expect(await db.tombstones.count()).toBe(0);
    expect(await db.syncState.count()).toBe(0);
  });
});
