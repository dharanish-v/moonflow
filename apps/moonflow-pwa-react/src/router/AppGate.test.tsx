// Automates the highest-blast-radius property of this rewrite: back/forward
// cannot bypass the PIN lock, and a deep link resolves post-unlock. Pure
// state+routing, no real layout, so this is exactly the kind of thing jsdom
// *can* verify — chrome-devtools MCP stays required for everything it can't
// (touch targets, real device emulation), but this property doesn't need a
// browser to prove.
import 'fake-indexeddb/auto';
import { fireEvent, render, screen } from '@testing-library/react';
import { HashRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SETTINGS_DEFAULTS } from '../lib/db';
import type { Settings } from '../lib/types';
import { AppGate } from './AppGate';
import { AppRoutes } from './routes';
import { StateProvider } from '../state/store';

function renderGated(hash: string, settings: Partial<Settings>) {
  window.location.hash = hash;
  return render(
    <HashRouter>
      <StateProvider testState={{ settings: { ...SETTINGS_DEFAULTS, ...settings } }}>
        <AppGate>
          <AppRoutes />
        </AppGate>
      </StateProvider>
    </HashRouter>,
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
  it('shows the PIN lock screen instead of any route when locked, regardless of the URL', () => {
    renderGated('#/settings', LOCKED_SETTINGS);
    expect(screen.getByRole('heading', { name: /enter your pin/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Settings' })).not.toBeInTheDocument();
  });

  it('back/forward while locked cannot reveal a route — Routes is simply not mounted', () => {
    renderGated('#/settings', LOCKED_SETTINGS);
    fireEvent(window, new PopStateEvent('popstate'));
    expect(screen.getByRole('heading', { name: /enter your pin/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Settings' })).not.toBeInTheDocument();
  });

  it('unlocking with the correct PIN navigates to the deep-linked screen the URL pointed to at boot', async () => {
    renderGated('#/settings', LOCKED_SETTINGS);
    const input = screen.getByLabelText('Enter your PIN');
    fireEvent.change(input, { target: { value: '1234' } });
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /enter your pin/i })).not.toBeInTheDocument();
  });

  it('a wrong PIN shows an error and stays locked', async () => {
    renderGated('#/', LOCKED_SETTINGS);
    const input = screen.getByLabelText('Enter your PIN');
    fireEvent.change(input, { target: { value: '0000' } });
    expect(await screen.findByText('Wrong PIN')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /enter your pin/i })).toBeInTheDocument();
  });

  it('does not lock when the PIN feature is disabled, even mid-navigation', () => {
    renderGated('#/calendar', {
      onboardingComplete: true,
      pinLockEnabled: false,
      pinHash: null,
      lastPeriodStart: '2026-08-01',
    });
    expect(screen.getByText(/january|february|march|april|may|june|july|august|september|october|november|december/i)).toBeInTheDocument();
  });
});

describe('AppGate — onboarding', () => {
  it('shows onboarding when not yet onboarded, skipping the lock entirely', () => {
    renderGated('#/settings', { onboardingComplete: false });
    expect(screen.getByRole('heading', { name: "Let's set up Moonflow" })).toBeInTheDocument();
  });

  it('completing onboarding reveals the app without requiring a separate unlock step', async () => {
    renderGated('#/', { onboardingComplete: false });
    fireEvent.change(screen.getByLabelText('When did your last period start?'), { target: { value: '2026-08-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Get started' }));
    expect(await screen.findByText('பிறை')).toBeInTheDocument();
  });
});
