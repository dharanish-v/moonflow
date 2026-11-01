import 'fake-indexeddb/auto';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SETTINGS_DEFAULTS, saveSettings } from '../lib/db';
import * as push from '../lib/push';
import type { AccountSession, Entry, Settings } from '../lib/types';
import type { AppState } from '../state/actions';
import { renderRouted } from '../test/render-with-router';
import { StateProbe } from '../test/state-probe';
import { StateProvider } from '../state/store';
import { SettingsScreen } from '../screens/Settings';

const SESSION: AccountSession = { userId: 'u1', email: 'me@example.com', token: 'tok' };
const ENTRY: Entry = { date: '2026-09-01', flow: 'medium', symptoms: [], mood: null, note: '', updatedAt: 1 };

async function openReminders(settings: Partial<Settings>) {
  let latest: AppState | null = null;
  const all = { ...SETTINGS_DEFAULTS, onboardingComplete: true, lastPeriodStart: '2026-09-01', ...settings };
  await saveSettings(all);
  await renderRouted(
    <StateProvider testState={{ entries: [ENTRY], settings: all }}>
      <SettingsScreen />
      <StateProbe onState={(s) => (latest = s)} />
    </StateProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: /calendar reminders/i }));
  await screen.findByText('Notifications');
  return () => latest!;
}

describe('Calendar reminders → Notifications (T103)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ACCOUNTS', '1');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 20, 12, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('asks to sign in first', async () => {
    await openReminders({ account: null });
    expect(screen.getByText(/Sign in \(Settings → Account\) to get a notification/)).toBeInTheDocument();
  });

  it('asks to install the app where push isn’t available (a Safari tab on iPhone)', async () => {
    vi.spyOn(push, 'pushSupported').mockReturnValue(false);
    await openReminders({ account: SESSION });
    expect(screen.getByText('Add Moonflow to your Home Screen to get notifications.')).toBeInTheDocument();
  });

  it('turns on with the reminder times for the next predicted periods', async () => {
    vi.spyOn(push, 'pushSupported').mockReturnValue(true);
    const enable = vi.spyOn(push, 'enablePush').mockImplementation(async () => {
      await saveSettings({ pushReminders: { recordId: 'r', endpoint: 'e', reminders: [1] } });
      return { ok: true };
    });
    const state = await openReminders({ account: SESSION });
    fireEvent.click(screen.getByRole('switch', { name: 'Notify me the day before, at 9am' }));
    await waitFor(() => expect(state().settings.pushReminders).not.toBeNull());
    const [session, times] = enable.mock.calls[0]!;
    expect(session).toEqual(SESSION);
    expect(times.length).toBeGreaterThan(0);
    expect(new Date(times[0]! * 1000).getHours()).toBe(9);
    expect(await screen.findByRole('switch', { name: /Period likely tomorrow/ })).not.toBeChecked();
  });

  it('shows why turning on failed', async () => {
    vi.spyOn(push, 'pushSupported').mockReturnValue(true);
    vi.spyOn(push, 'enablePush').mockResolvedValue({ ok: false, error: 'Notifications are turned off for Moonflow.' });
    await openReminders({ account: SESSION });
    fireEvent.click(screen.getByRole('switch', { name: 'Notify me the day before, at 9am' }));
    expect(await screen.findByText('Notifications are turned off for Moonflow.')).toBeInTheDocument();
  });

  it('turns off, and the detailed-text choice stays on this phone', async () => {
    vi.spyOn(push, 'pushSupported').mockReturnValue(true);
    const disable = vi.spyOn(push, 'disablePush').mockImplementation(async () => {
      await saveSettings({ pushReminders: null });
    });
    const state = await openReminders({ account: SESSION, pushReminders: { recordId: 'r', endpoint: 'e', reminders: [1] } });
    fireEvent.click(screen.getByRole('switch', { name: /Period likely tomorrow/ }));
    await waitFor(() => expect(state().settings.detailedReminderText).toBe(true));
    fireEvent.click(screen.getByRole('switch', { name: 'Notify me the day before, at 9am' }));
    await waitFor(() => expect(state().settings.pushReminders).toBeNull());
    expect(disable).toHaveBeenCalledWith(SESSION);
  });

  it('has no accessibility violations', async () => {
    vi.useRealTimers();
    vi.spyOn(push, 'pushSupported').mockReturnValue(true);
    await openReminders({ account: SESSION, pushReminders: { recordId: 'r', endpoint: 'e', reminders: [1] } });
    expect(await axe(document.body)).toHaveNoViolations();
  });
});
