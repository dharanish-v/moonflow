import 'fake-indexeddb/auto';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SETTINGS_DEFAULTS, db } from '../lib/db';
import * as sync from '../lib/sync';
import { notifyLocalChange } from '../lib/sync-signal';
import { requestSync } from '../lib/sync-trigger';
import type { AccountSession } from '../lib/types';
import { StateProvider } from '../state/store';
import { SyncRunner } from './SyncRunner';

const SESSION: AccountSession = { userId: 'u1', email: 'me@example.com', token: 'tok' };

function mount(account: AccountSession | null) {
  return render(
    <StateProvider testState={{ settings: { ...SETTINGS_DEFAULTS, onboardingComplete: true, account } }}>
      <SyncRunner />
    </StateProvider>,
  );
}

// Lets the runner's promise chain (status load → sync → reload) settle.
const settle = () => act(async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  await vi.advanceTimersByTimeAsync(0);
});

describe('SyncRunner (ADR-054 triggers)', () => {
  let run: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    // The runner reloads settings from the database after a sync, so the
    // session must be there too, as it always is in the app.
    await db.settings.put({ key: 'account', value: SESSION });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.stubEnv('VITE_ACCOUNTS', '1');
    vi.spyOn(sync, 'loadSyncStatus').mockResolvedValue();
    run = vi.spyOn(sync, 'syncDatabase').mockResolvedValue({ result: 'synced', changed: false, rejected: 0 });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('does nothing when signed out, or when accounts are off', async () => {
    mount(null).unmount();
    vi.stubEnv('VITE_ACCOUNTS', '');
    mount(SESSION);
    await settle();
    expect(run).not.toHaveBeenCalled();
  });

  it('syncs on start, and again a few seconds after a local change', async () => {
    mount(SESSION);
    await settle();
    expect(run).toHaveBeenCalledTimes(1);
    act(() => {
      notifyLocalChange();
      notifyLocalChange();
    });
    await act(() => vi.advanceTimersByTimeAsync(2900));
    expect(run).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('syncs when the app comes back to the foreground, comes online, or on Sync now', async () => {
    mount(SESSION);
    await settle();
    act(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await settle();
    expect(run).toHaveBeenCalledTimes(1); // waits for a possible relock first
    await act(() => vi.advanceTimersByTimeAsync(500));
    await settle();
    act(() => window.dispatchEvent(new Event('online')));
    await settle();
    act(() => requestSync());
    await settle();
    expect(run).toHaveBeenCalledTimes(4);
  });

  it('retries with backoff while offline', async () => {
    run.mockResolvedValue({ result: 'offline' });
    mount(SESSION);
    await settle();
    expect(run).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(run).toHaveBeenCalledTimes(2);
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(run).toHaveBeenCalledTimes(2);
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('a relock right after returning cancels the foreground sync', async () => {
    const view = mount(SESSION);
    await settle();
    act(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    view.unmount(); // AppGate showed the PIN screen
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('stops when signed out', async () => {
    const view = mount(SESSION);
    await settle();
    view.unmount();
    act(() => requestSync());
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(run).toHaveBeenCalledTimes(1);
  });
});
