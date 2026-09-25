// T48 — duress PIN opens an empty decoy; panic wipe erases everything.
import 'fake-indexeddb/auto';
import { RouterProvider, createHashHistory, createRouter } from '@tanstack/react-router';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SETTINGS_DEFAULTS, activeDatabase, db, saveEntry, saveSettings, switchDatabase } from '../lib/db';
import { hashPin } from '../lib/pin-auth';
import type { Settings } from '../lib/types';
import { routeTree } from '../router/router';
import { StateProvider } from '../state/store';

async function renderApp(hash: string) {
  window.location.hash = hash;
  const router = createRouter({ routeTree, history: createHashHistory() });
  await router.load();
  return render(
    <StateProvider>
      <RouterProvider router={router} />
    </StateProvider>,
  );
}

async function typePin(label: RegExp, pin: string) {
  fireEvent.change(await screen.findByLabelText(label), { target: { value: pin } });
}

describe('duress PIN', () => {
  beforeEach(async () => {
    await switchDatabase('real');
    await db.entries.clear();
    await db.settings.clear();
    const real: Partial<Settings> = {
      ...SETTINGS_DEFAULTS,
      onboardingComplete: true,
      lastPeriodStart: '2026-08-01',
      pinLockEnabled: true,
      pinHash: await hashPin('1234', 1000),
      duressPinHash: await hashPin('9999', 1000),
    };
    await saveSettings(real);
    await saveEntry({ date: '2026-08-01', flow: 'heavy', symptoms: ['cramps'], mood: null, note: 'real secret', updatedAt: 0 } as never);
  });
  afterEach(() => switchDatabase('real'));

  it('the duress PIN opens an empty-looking app, and nothing done there touches the real data', async () => {
    await renderApp('#/insights');
    await typePin(/enter your pin/i, '9999');
    await waitFor(() => expect(activeDatabase()).toBe('decoy'));
    expect(await screen.findByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    expect(screen.queryByText(/real secret/)).not.toBeInTheDocument();
    expect(await screen.findByText(/no periods logged yet/i)).toBeInTheDocument();

    await switchDatabase('real');
    expect(await db.entries.count()).toBe(1);
  });

  it('the real PIN still opens the real data', async () => {
    await renderApp('#/');
    await typePin(/enter your pin/i, '1234');
    await waitFor(() => expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument());
    expect(activeDatabase()).toBe('real');
  });
});

describe('panic wipe', () => {
  beforeEach(async () => {
    await switchDatabase('real');
    await db.entries.clear();
    await db.settings.clear();
    await saveSettings({ ...SETTINGS_DEFAULTS, onboardingComplete: true, lastPeriodStart: '2026-08-01' });
    await saveEntry({ date: '2026-08-01', flow: 'heavy', symptoms: [], mood: null, note: '' } as never);
  });

  it('Settings → Erase all data wipes everything after confirmation', async () => {
    await renderApp('#/settings');
    fireEvent.click(await screen.findByRole('button', { name: /erase all data/i }));
    fireEvent.change(await screen.findByLabelText(/type erase to confirm/i), { target: { value: 'ERASE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Erase everything' }));
    expect(await screen.findByRole('heading', { name: "Let's set up Moonflow" })).toBeInTheDocument();
    expect(await db.entries.count()).toBe(0);
  });
});

describe('duress PIN setup', () => {
  beforeEach(async () => {
    await switchDatabase('real');
    await db.entries.clear();
    await db.settings.clear();
    await saveSettings({
      ...SETTINGS_DEFAULTS,
      onboardingComplete: true,
      lastPeriodStart: '2026-08-01',
      pinLockEnabled: false,
      pinHash: await hashPin('1234', 1000),
    });
  });

  it('refuses the real PIN as the duress PIN, accepts a different one', async () => {
    await renderApp('#/settings/duress-setup');
    await typePin(/set a duress pin/i, '1234');
    expect(await screen.findByText('Must be different from your real PIN')).toBeInTheDocument();
    await typePin(/set a duress pin/i, '5555');
    await typePin(/confirm duress pin/i, '5555');
    expect(await screen.findByRole('heading', { name: 'Settings' }, { timeout: 5000 })).toBeInTheDocument();
    const { getSetting } = await import('../lib/db');
    expect(await getSetting('duressPinHash')).toMatch(/^pbkdf2-sha256\$/);
  });
});
