import 'fake-indexeddb/auto';
import { screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { SETTINGS_DEFAULTS } from '../lib/db';
import { renderRouted } from '../test/render-with-router';
import { StateProvider } from '../state/store';
import { HomeScreen } from './Home';

describe('HomeScreen', () => {
  it('has no accessibility violations', async () => {
    const { container } = await renderRouted(
      // lastPeriodStart is never actually null once onboarded — onboarding
      // always sets a real date first — so give it one here too.
      <StateProvider testState={{ settings: { ...SETTINGS_DEFAULTS, lastPeriodStart: '2026-08-10' } }}>
        <HomeScreen />
      </StateProvider>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('HomeScreen — backup reminder', () => {
  const entry = { date: '2026-01-05', flow: 'medium' as const, symptoms: [], mood: null, note: '', updatedAt: 0 };

  it('shows a gentle reminder linking to Settings when there is real history and no recent backup', async () => {
    await renderRouted(
      <StateProvider testState={{ entries: [entry], settings: { ...SETTINGS_DEFAULTS, lastPeriodStart: '2026-01-05', lastBackupAt: null } }}>
        <HomeScreen />
      </StateProvider>,
    );
    expect(screen.getByRole('link', { name: /back up.*haven't backed up yet/i })).toHaveAttribute('href', expect.stringContaining('/settings'));
  });

  it('stays quiet right after a backup', async () => {
    await renderRouted(
      <StateProvider testState={{ entries: [entry], settings: { ...SETTINGS_DEFAULTS, lastPeriodStart: '2026-01-05', lastBackupAt: Date.now() } }}>
        <HomeScreen />
      </StateProvider>,
    );
    expect(screen.queryByRole('link', { name: /back up/i })).not.toBeInTheDocument();
  });
});
