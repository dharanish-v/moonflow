// src/lib/sync-trigger.ts — T99: lets "Sync now" reach the running
// SyncRunner. A no-op when signed out or accounts are off.
let trigger: (() => void) | null = null;

export function setSyncTrigger(fn: (() => void) | null) {
  trigger = fn;
}

export function requestSync() {
  trigger?.();
}
