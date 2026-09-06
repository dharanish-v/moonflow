// Automates the highest-blast-radius property of this rewrite: back/forward
// cannot bypass the PIN lock, and a deep link resolves post-unlock. Pure
// state+routing, no real layout, so this is exactly the kind of thing jsdom
// *can* verify — chrome-devtools MCP stays required for everything it can't
// (touch targets, real device emulation), but this property doesn't need a
// browser to prove.
//
// Builds the REAL routeTree (not a throwaway single-route stub like other
// screen tests use) with its own fresh createHashHistory() per render —
// this test is specifically exercising route-to-route + lock-state
// behavior, so it needs the actual app composition (RootLayout -> AppGate
// -> Outlet), not an isolated component.
import 'fake-indexeddb/auto';
import { RouterProvider, createHashHistory, createRouter } from '@tanstack/react-router';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SETTINGS_DEFAULTS } from '../lib/db';
import type { Settings } from '../lib/types';
import { routeTree } from './router';
import { StateProvider } from '../state/store';

async function renderGated(hash: string, settings: Partial<Settings>) {
  window.location.hash = hash;
  const router = createRouter({ routeTree, history: createHashHistory() });
  // Route matching resolves a tick after mount — without this, render()
  // returns before the matched route commits, and a synchronous
  // getByRole() right after sees an empty tree.
  await router.load();
  return render(
    <StateProvider testState={{ settings: { ...SETTINGS_DEFAULTS, ...settings } }}>
      <RouterProvider router={router} />
    </StateProvider>,
  );
}

// SHA-256("1234") — same known digest pin-auth.test.ts asserts hashPin produces.
const KNOWN_PIN_HASH = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';

const LOCKED_SETTINGS: Partial<Settings> = {
  onboardingComplete: true,
  pinLockEnabled: true,
  pinHash: KNOWN_PIN_HASH,
};

describe('AppGate — PIN lock', () => {
  it('shows the PIN lock screen instead of any route when locked, regardless of the URL', async () => {
    await renderGated('#/settings', LOCKED_SETTINGS);
    expect(screen.getByRole('heading', { name: /enter your pin/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Settings' })).not.toBeInTheDocument();
  });

  it('back/forward while locked cannot reveal a route — Routes is simply not mounted', async () => {
    await renderGated('#/settings', LOCKED_SETTINGS);
    fireEvent(window, new PopStateEvent('popstate'));
    expect(screen.getByRole('heading', { name: /enter your pin/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Settings' })).not.toBeInTheDocument();
  });

  it('unlocking with the correct PIN navigates to the deep-linked screen the URL pointed to at boot', async () => {
    await renderGated('#/settings', LOCKED_SETTINGS);
    const input = screen.getByLabelText('Enter your PIN');
    fireEvent.change(input, { target: { value: '1234' } });
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /enter your pin/i })).not.toBeInTheDocument();
  });

  it('a wrong PIN shows an error and stays locked', async () => {
    await renderGated('#/', LOCKED_SETTINGS);
    const input = screen.getByLabelText('Enter your PIN');
    fireEvent.change(input, { target: { value: '0000' } });
    expect(await screen.findByText('Wrong PIN')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /enter your pin/i })).toBeInTheDocument();
  });

  it('does not lock when the PIN feature is disabled, even mid-navigation', async () => {
    await renderGated('#/calendar', {
      onboardingComplete: true,
      pinLockEnabled: false,
      pinHash: null,
      lastPeriodStart: '2026-08-01',
    });
    expect(screen.getByText(/january|february|march|april|may|june|july|august|september|october|november|december/i)).toBeInTheDocument();
  });
});

describe('AppGate — onboarding', () => {
  it('shows onboarding when not yet onboarded, skipping the lock entirely', async () => {
    await renderGated('#/settings', { onboardingComplete: false });
    expect(screen.getByRole('heading', { name: "Let's set up Moonflow" })).toBeInTheDocument();
  });

  it('completing onboarding reveals the app without requiring a separate unlock step', async () => {
    await renderGated('#/', { onboardingComplete: false });
    // The date picker is shadcn's Popover+Calendar (react-day-picker), not a
    // native input — open it and pick today, the one day always enabled
    // and locatable without depending on the real wall-clock date's value.
    fireEvent.click(screen.getByRole('button', { name: /when did your last period start/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^today,/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Get started' }));
    expect(await screen.findByText('Flow')).toBeInTheDocument();
  });
});
