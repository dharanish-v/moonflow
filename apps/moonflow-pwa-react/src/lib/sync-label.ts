// src/lib/sync-label.ts — T99: the one-line sync status shown in Settings
// (ADR-054: status lives only there, no Home nudge).
import type { SyncStatus } from './sync';

function ago(ms: number): string {
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

export function syncLabel(status: SyncStatus, now: number): string {
  if (status.state === 'expired') return 'Sign in again to sync';
  if (status.state === 'syncing') return 'Syncing…';
  if (status.state === 'offline') return 'Waiting to sync (offline)';
  if (status.rejected > 0) return `${status.rejected} ${status.rejected === 1 ? 'day' : 'days'} couldn't sync`;
  if (status.lastSyncedAt) return `Synced ${ago(now - status.lastSyncedAt)}`;
  return 'Not synced yet';
}
