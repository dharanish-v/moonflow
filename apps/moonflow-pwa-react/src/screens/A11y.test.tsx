// T56 accessibility guarantees across screens.
import 'fake-indexeddb/auto';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SETTINGS_DEFAULTS } from '../lib/db';
import { validateLogSearch } from '../router/router';
import { renderRouted } from '../test/render-with-router';
import { StateProvider } from '../state/store';
import { HomeScreen } from './Home';
import { LogEntryScreen } from './LogEntry';

const SETTINGS = { ...SETTINGS_DEFAULTS, onboardingComplete: true, lastPeriodStart: '2026-09-10' };

describe('accessibility', () => {
  it('Home leads with an h1 (the headline) and describes the cycle ring in words', async () => {
    await renderRouted(<HomeScreen />, { wrapper: (c) => <StateProvider testState={{ settings: SETTINGS }}>{c}</StateProvider> });
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /cycle day \d+ of \d+/i })).toBeInTheDocument();
  });

  it('Home has no unexplained decorative words (the பிறை signature was removed)', async () => {
    const { container } = await renderRouted(<HomeScreen />, { wrapper: (c) => <StateProvider testState={{ settings: SETTINGS }}>{c}</StateProvider> });
    expect(container.textContent).not.toMatch(/[\u0B80-\u0BFF]/); // Tamil block
  });

  it('the "estimated" explainer is a full-size touch target', async () => {
    await renderRouted(<HomeScreen />, { wrapper: (c) => <StateProvider testState={{ settings: SETTINGS }}>{c}</StateProvider> });
    expect(screen.getByRole('button', { name: /why is this estimated/i }).className).toMatch(/min-h-11/);
  });

  it('opening the log sheet moves focus into it', async () => {
    await renderRouted(<LogEntryScreen />, {
      path: '/log',
      initialEntries: ['/log?date=2026-09-20'],
      validateSearch: validateLogSearch,
      wrapper: (c) => <StateProvider testState={{ settings: SETTINGS }}>{c}</StateProvider>,
    });
    await waitFor(() => expect(document.activeElement).not.toBe(document.body));
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });

});
