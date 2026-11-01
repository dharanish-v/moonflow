import 'fake-indexeddb/auto';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as account from '../lib/account';
import type { AccountSession } from '../lib/types';
import type { AppState } from '../state/actions';
import { renderRouted } from '../test/render-with-router';
import { StateProbe } from '../test/state-probe';
import { StateProvider } from '../state/store';
import { SettingsScreen } from '../screens/Settings';

const SESSION: AccountSession = { userId: 'u1', email: 'me@example.com', token: 'tok' };

async function renderSettings(signedIn: AccountSession | null = null) {
  let latest: AppState | null = null;
  const view = await renderRouted(
    <StateProvider testState={{ settings: { ...(await import('../lib/db')).SETTINGS_DEFAULTS, onboardingComplete: true, account: signedIn } }}>
      <SettingsScreen />
      <StateProbe onState={(s) => (latest = s)} />
    </StateProvider>,
  );
  return { ...view, state: () => latest! };
}

function openAccount() {
  fireEvent.click(screen.getByRole('button', { name: /^Account/ }));
}

describe('Account (T98)', () => {
  beforeEach(() => vi.stubEnv('VITE_ACCOUNTS', '1'));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('is hidden unless the build turns accounts on', async () => {
    vi.stubEnv('VITE_ACCOUNTS', '');
    await renderSettings();
    expect(screen.queryByRole('button', { name: /^Account/ })).not.toBeInTheDocument();
  });

  it('says what an account means before anyone makes one', async () => {
    await renderSettings();
    openAccount();
    expect(await screen.findByText('What an account means')).toBeInTheDocument();
    expect(screen.getByText(/stored unencrypted\. The server's admin and the hosting provider can read them/)).toBeInTheDocument();
    expect(screen.getByText(/never leave it/)).toBeInTheDocument();
  });

  it('needs a 10-character password, a match and the acknowledgement to create an account', async () => {
    await renderSettings();
    openAccount();
    fireEvent.click(await screen.findByRole('button', { name: 'Create account' }));
    const submit = screen.getByRole('button', { name: 'Create account' });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'me@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ninechars' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'ninechars' } });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'long enough pw' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'long enough pX' } });
    expect(screen.getByText("Passwords don't match")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'long enough pw' } });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByRole('switch', { name: /I understand my logs are stored on the server unencrypted/ }));
    expect(submit).toBeEnabled();
  });

  it('signs up and remembers the session on this phone', async () => {
    const signUp = vi.spyOn(account, 'signUp').mockResolvedValue({ ok: true, session: SESSION });
    const { state } = await renderSettings();
    openAccount();
    fireEvent.click(await screen.findByRole('button', { name: 'Create account' }));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'me@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'long enough pw' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'long enough pw' } });
    fireEvent.click(screen.getByRole('switch', { name: /I understand/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(state().settings.account).toEqual(SESSION));
    expect(signUp).toHaveBeenCalledWith('me@example.com', 'long enough pw');
    expect(await screen.findByText('Signed in as me@example.com.')).toBeInTheDocument();
  });

  it('shows the server’s reason when signing in fails', async () => {
    vi.spyOn(account, 'signIn').mockResolvedValue({ ok: false, error: 'That email and password don’t match an account.' });
    const { state } = await renderSettings();
    openAccount();
    fireEvent.click(await screen.findByRole('button', { name: 'I already have an account' }));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'me@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText(/don’t match an account/)).toBeInTheDocument();
    expect(state().settings.account).toBeNull();
  });

  it('signs out without touching the logs on this phone', async () => {
    const { state } = await renderSettings(SESSION);
    expect(screen.getByRole('button', { name: 'Account, me@example.com' })).toBeInTheDocument();
    openAccount();
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(state().settings.account).toBeNull());
  });

  it('deletes the account only after typing DELETE', async () => {
    const del = vi.spyOn(account, 'deleteAccount').mockResolvedValue({ ok: true });
    const { state } = await renderSettings(SESSION);
    openAccount();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete account' }));
    const dialog = await screen.findByRole('alertdialog');
    const confirm = within(dialog).getByRole('button', { name: 'Delete account' });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText('Type DELETE to confirm'), { target: { value: 'delete' } });
    fireEvent.click(confirm);
    await waitFor(() => expect(state().settings.account).toBeNull());
    expect(del).toHaveBeenCalledWith(SESSION);
  });

  it('keeps the session when deleting fails', async () => {
    vi.spyOn(account, 'deleteAccount').mockResolvedValue({ ok: false, error: "Can't reach the server. Check your connection and try again." });
    const { state } = await renderSettings(SESSION);
    openAccount();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete account' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.change(within(dialog).getByLabelText('Type DELETE to confirm'), { target: { value: 'DELETE' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete account' }));
    expect(await screen.findByText(/Can't reach the server/)).toBeInTheDocument();
    expect(state().settings.account).toEqual(SESSION);
  });

  it('warns that erasing this phone leaves the server copy', async () => {
    await renderSettings(SESSION);
    fireEvent.click(screen.getByRole('button', { name: 'Erase all data' }));
    expect(await screen.findByText(/your copy on the server stays/)).toBeInTheDocument();
  });

  it('has no accessibility violations, signed out or in', async () => {
    const out = await renderSettings();
    openAccount();
    await screen.findByText('What an account means');
    expect(await axe(document.body)).toHaveNoViolations();
    out.unmount();
    await renderSettings(SESSION);
    openAccount();
    await screen.findByRole('button', { name: 'Sign out' });
    expect(await axe(document.body)).toHaveNoViolations();
  });
});
