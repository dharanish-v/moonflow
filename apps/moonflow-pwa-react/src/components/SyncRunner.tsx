// src/components/SyncRunner.tsx — T99: decides *when* to sync (ADR-054).
// Mounted by AppGate only once the app is unlocked, so nothing talks to the
// server before the PIN, and the database (real or decoy) is already known.
// Triggers: mount, a few seconds after a local change, back to foreground,
// back online, and "Sync now". Offline runs retry with backoff.
import { useEffect } from 'react';
import { loadAllEntries, loadAllSettings } from '../lib/db';
import { accountsEnabled } from '../lib/features';
import { pickSynced } from '../lib/sync-merge';
import { loadSyncStatus, syncDatabase } from '../lib/sync';
import { subscribeLocalChange } from '../lib/sync-signal';
import { setSyncTrigger } from '../lib/sync-trigger';
import { useAppDispatch, useAppState } from '../state/hooks';

const DEBOUNCE_MS = 3000;
const VISIBLE_DELAY_MS = 500;
const RETRY_MS = [30_000, 60_000, 120_000, 300_000];

export function SyncRunner() {
  const { settings } = useAppState();
  const dispatch = useAppDispatch();
  const userId = accountsEnabled() ? settings.account?.userId : undefined;

  useEffect(() => {
    if (!userId) return;
    let stopped = false;
    let running = false;
    let again = false;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;

    async function run() {
      if (stopped) return;
      if (running) {
        again = true;
        return;
      }
      running = true;
      clearTimeout(retry);
      const outcome = await syncDatabase();
      running = false;
      if (stopped) return;
      if (outcome.result === 'synced') {
        failures = 0;
        const [entries, fresh] = await Promise.all([loadAllEntries(), loadAllSettings()]);
        if (stopped) return;
        if (outcome.changed) dispatch({ type: 'SET_ENTRIES', entries });
        dispatch({ type: 'PATCH_SETTINGS', patch: { ...pickSynced(fresh), account: fresh.account } });
      } else if (outcome.result === 'offline') {
        retry = setTimeout(() => void run(), RETRY_MS[Math.min(failures++, RETRY_MS.length - 1)]);
      }
      if (again) {
        again = false;
        void run();
      }
    }

    const soon = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => void run(), DEBOUNCE_MS);
    };
    // Back in the foreground, wait a moment: if the PIN relock is due, AppGate
    // unmounts this runner first and nothing reaches the server before the PIN.
    let visible: ReturnType<typeof setTimeout> | undefined;
    const onVisible = () => {
      if (document.hidden) return;
      clearTimeout(visible);
      visible = setTimeout(() => void run(), VISIBLE_DELAY_MS);
    };
    const onOnline = () => void run();

    setSyncTrigger(() => void run());
    const offChange = subscribeLocalChange(soon);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    void loadSyncStatus().then(() => run());

    return () => {
      stopped = true;
      setSyncTrigger(null);
      clearTimeout(debounce);
      clearTimeout(retry);
      clearTimeout(visible);
      offChange();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [userId, dispatch]);

  return null;
}
