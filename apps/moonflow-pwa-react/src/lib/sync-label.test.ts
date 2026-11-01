import { describe, expect, it } from 'vitest';
import { syncLabel } from './sync-label';

const base = { state: 'idle' as const, lastSyncedAt: null, rejected: 0 };
const now = 10 * 86_400_000;

describe('syncLabel', () => {
  it('puts problems first', () => {
    expect(syncLabel({ ...base, state: 'expired', rejected: 2 }, now)).toBe('Sign in again to sync');
    expect(syncLabel({ ...base, state: 'offline' }, now)).toBe('Waiting to sync (offline)');
    expect(syncLabel({ ...base, rejected: 1, lastSyncedAt: now }, now)).toBe("1 day couldn't sync");
    expect(syncLabel({ ...base, rejected: 3, lastSyncedAt: now }, now)).toBe("3 days couldn't sync");
  });

  it('says how long ago it last synced', () => {
    expect(syncLabel(base, now)).toBe('Not synced yet');
    expect(syncLabel({ ...base, lastSyncedAt: now - 20_000 }, now)).toBe('Synced just now');
    expect(syncLabel({ ...base, lastSyncedAt: now - 5 * 60_000 }, now)).toBe('Synced 5 min ago');
    expect(syncLabel({ ...base, lastSyncedAt: now - 3 * 3_600_000 }, now)).toBe('Synced 3 h ago');
    expect(syncLabel({ ...base, lastSyncedAt: now - 86_400_000 }, now)).toBe('Synced yesterday');
    expect(syncLabel({ ...base, lastSyncedAt: now - 4 * 86_400_000 }, now)).toBe('Synced 4 days ago');
  });
});
