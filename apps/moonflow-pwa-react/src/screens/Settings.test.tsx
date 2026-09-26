import 'fake-indexeddb/auto';
import { fireEvent, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as db from '../lib/db';
import type { AppState } from '../state/actions';
import { renderRouted } from '../test/render-with-router';
import { StateProbe } from '../test/state-probe';
import { StateProvider } from '../state/store';
import { SettingsScreen } from './Settings';

async function renderSettings() {
  let latest: AppState | null = null;
  await renderRouted(
    <StateProvider testState={{}}>
      <SettingsScreen />
      <StateProbe onState={(s) => (latest = s)} />
    </StateProvider>,
  );
  return () => latest!;
}

describe('SettingsScreen', () => {
  afterEach(() => vi.restoreAllMocks());

  it('has no accessibility violations', async () => {
    const { container } = await renderRouted(
      <StateProvider testState={{}}>
        <SettingsScreen />
      </StateProvider>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('states plainly that the app is not a medical device', async () => {
    await renderSettings();
    expect(screen.getByText(/not a medical device/i)).toBeInTheDocument();
  });

  it('has no dead "coming soon" controls', async () => {
    await renderSettings();
    expect(screen.queryByRole('switch', { name: 'Reminders' })).not.toBeInTheDocument();
  });

  it('explains when the average lengths are actually used', async () => {
    await renderSettings();
    expect(screen.getByText(/used for predictions until you've logged two cycles/i)).toBeInTheDocument();
  });

  it('can pause predictions', async () => {
    const state = await renderSettings();
    fireEvent.click(screen.getByRole('switch', { name: 'Pause predictions' }));
    const { waitFor } = await import('@testing-library/react');
    await waitFor(() => expect(state().settings.predictionsPaused).toBe(true));
  });

  it('a failed theme write shows an error and leaves the theme unchanged', async () => {
    vi.spyOn(db, 'saveSettings').mockResolvedValue(false);
    const state = await renderSettings();
    fireEvent.click(screen.getByRole('radio', { name: /dark/i }));
    expect(await screen.findByText("Couldn't save — try again")).toBeInTheDocument();
    expect(state().settings.themeMode).toBe('system');
  });
});
