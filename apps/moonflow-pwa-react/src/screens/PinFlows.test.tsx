// End-to-end PIN flows through the real route tree + AppGate (T34).
import 'fake-indexeddb/auto';
import { RouterProvider, createHashHistory, createRouter } from '@tanstack/react-router';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { SETTINGS_DEFAULTS, db, getSetting, saveEntry, saveSettings } from '../lib/db';
import type { Settings } from '../lib/types';
import { routeTree } from '../router/router';
import { StateProvider } from '../state/store';

// SHA-256("1234") — legacy stored format.
const LEGACY_1234 = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';
const BASE: Partial<Settings> = { onboardingComplete: true, lastPeriodStart: '2026-08-01' };

async function renderApp(hash: string, settings: Partial<Settings>) {
  await saveSettings({ ...SETTINGS_DEFAULTS, ...settings });
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

describe('PIN flows', () => {
  beforeEach(async () => {
    await db.entries.clear();
    await db.settings.clear();
  });

  it('turning the lock off requires the current PIN first', async () => {
    await renderApp('#/settings', { ...BASE, pinLockEnabled: true, pinHash: LEGACY_1234 });
    await typePin(/enter your pin/i, '1234');
    fireEvent.click(await screen.findByRole('switch', { name: 'App lock' }));
    expect(await screen.findByRole('heading', { name: 'Enter your current PIN' })).toBeInTheDocument();
    expect(await getSetting('pinLockEnabled')).toBe(true);

    await typePin(/enter your current pin/i, '0000');
    expect(await screen.findByText('Wrong PIN')).toBeInTheDocument();
    expect(await getSetting('pinLockEnabled')).toBe(true);

    await typePin(/enter your current pin/i, '1234');
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    await waitFor(async () => expect(await getSetting('pinLockEnabled')).toBe(false));
  });

  it('turning the lock back on always sets a fresh PIN (never silently reuses a forgotten one)', async () => {
    await renderApp('#/settings', { ...BASE, pinLockEnabled: false, pinHash: LEGACY_1234 });
    fireEvent.click(await screen.findByRole('switch', { name: 'App lock' }));
    expect(await screen.findByRole('heading', { name: 'Set a PIN' })).toBeInTheDocument();
  });

  it('unlocking with a legacy SHA-256 PIN upgrades it to salted PBKDF2', async () => {
    await renderApp('#/', { ...BASE, pinLockEnabled: true, pinHash: LEGACY_1234 });
    await typePin(/enter your pin/i, '1234');
    await waitFor(async () => expect(await getSetting('pinHash')).toMatch(/^pbkdf2-sha256\$/), { timeout: 5000 });
  });

  it('forgot PIN: erasing after a clear warning wipes everything and starts over', async () => {
    await saveEntry({ date: '2026-08-01', flow: 'medium', symptoms: [], mood: null, note: '' });
    await renderApp('#/', { ...BASE, pinLockEnabled: true, pinHash: LEGACY_1234 });
    fireEvent.click(await screen.findByRole('button', { name: /forgot pin/i }));
    expect(await screen.findByText(/permanently erases every log/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /erase everything/i }));
    expect(await screen.findByRole('heading', { name: "Let's set up Moonflow" })).toBeInTheDocument();
    expect(await db.entries.count()).toBe(0);
  });
});
