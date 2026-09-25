import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it, vi } from 'vitest';
import { db, onDatabaseReplaced } from './db';

describe('schema upgrade from another open copy (Moonflow + Planner icons)', () => {
  it('closes this connection and notifies, instead of blocking the upgrade', async () => {
    await db.open();
    const replaced = vi.fn();
    const unsubscribe = onDatabaseReplaced(replaced);

    const newer = new Dexie('MoonflowDB');
    newer.version(1).stores({ entries: 'date', settings: 'key' });
    newer.version(2).stores({ entries: 'date', settings: 'key', extra: 'id' });
    await newer.open(); // would hang ("blocked") if the old connection stayed open

    expect(replaced).toHaveBeenCalled();
    expect(db.isOpen()).toBe(false);
    newer.close();
    unsubscribe();
  });
});
