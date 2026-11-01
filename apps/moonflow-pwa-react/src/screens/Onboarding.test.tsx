import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StateProvider } from '../state/store';
import { OnboardingScreen } from './Onboarding';

describe('OnboardingScreen', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(
      <StateProvider testState={{}}>
        <OnboardingScreen />
      </StateProvider>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('saves every onboarding value in one atomic write', async () => {
    const { submitOnboarding } = await import('../lib/onboarding');
    const calls: unknown[] = [];
    const ok = await submitOnboarding(
      { lastPeriodStart: '2026-09-01', avgCycleLength: 30, avgPeriodLength: 4 },
      async (patch) => {
        calls.push(patch);
        return true;
      },
    );
    expect(ok).toBe(true);
    expect(calls).toEqual([{ lastPeriodStart: '2026-09-01', avgCycleLength: 30, avgPeriodLength: 4, onboardingComplete: true }]);
    expect(screen.queryByText(/couldn.t save/i)).not.toBeInTheDocument();
  });
});

describe('OnboardingScreen — new phone, not installed (T60)', () => {
  it('offers restoring from a backup instead of setting up from scratch', async () => {
    render(
      <StateProvider testState={{}}>
        <OnboardingScreen />
      </StateProvider>,
    );
    expect(screen.getByRole('button', { name: /restore from a backup/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Import data file')).toBeInTheDocument();
  });

  it('warns when opened in a Safari tab instead of the installed app', async () => {
    const { isStandalone } = await import('../lib/install-identity');
    expect(isStandalone({ standalone: false } as unknown as Navigator, () => false)).toBe(false);
    expect(isStandalone({ standalone: true } as unknown as Navigator, () => false)).toBe(true);
    expect(isStandalone({} as unknown as Navigator, () => true)).toBe(true);
    render(
      <StateProvider testState={{}}>
        <OnboardingScreen />
      </StateProvider>,
    );
    // jsdom is never standalone
    expect(screen.getByText(/add to home screen/i)).toBeInTheDocument();
  });
});

describe('OnboardingScreen — native date wheel (T82)', () => {
  it('uses a native date input capped at today', async () => {
    render(
      <StateProvider testState={{}}>
        <OnboardingScreen />
      </StateProvider>,
    );
    const input = screen.getByLabelText(/when did your last period start/i);
    expect(input).toHaveAttribute('type', 'date');
    expect(input.getAttribute('max')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.change(input, { target: { value: '2026-09-01' } });
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
  });
});

describe('OnboardingScreen — three steps (T93)', () => {
  it('walks through cycle → privacy → safety, with back and a step counter', async () => {
    const { fireEvent } = await import('@testing-library/react');
    render(
      <StateProvider testState={{}}>
        <OnboardingScreen />
      </StateProvider>,
    );
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled(); // needs a date first
    fireEvent.change(screen.getByLabelText(/when did your last period start/i), { target: { value: '2026-09-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /private by design/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText(/when did your last period start/i)).toHaveValue('2026-09-01');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Step 3 of 3')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /set up a pin lock/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Get started' })).toBeEnabled();
  });
});

describe('OnboardingScreen — privacy step (T98)', () => {
  async function reachPrivacyStep() {
    const { fireEvent } = await import('@testing-library/react');
    render(
      <StateProvider testState={{}}>
        <OnboardingScreen />
      </StateProvider>,
    );
    fireEvent.change(document.getElementById('onboarding-date')!, { target: { value: '2026-09-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Private by design');
  }

  afterEach(() => vi.unstubAllEnvs());

  it('promises no account and no server when accounts are off', async () => {
    await reachPrivacyStep();
    expect(screen.getByText(/There's no account and no server/)).toBeInTheDocument();
  });

  it('says an account is optional when accounts are on', async () => {
    vi.stubEnv('VITE_ACCOUNTS', '1');
    await reachPrivacyStep();
    expect(screen.getByText(/An account is optional, only for syncing your devices/)).toBeInTheDocument();
    expect(screen.queryByText(/no account and no server/)).not.toBeInTheDocument();
  });
});

describe('OnboardingScreen — sign in to restore (after Erase all data, or a new phone)', () => {
  const SESSION = { userId: 'u1', email: 'me@example.com', token: 'tok' };

  async function signInToRestore(syncResult: () => Promise<unknown>) {
    const { fireEvent, waitFor } = await import('@testing-library/react');
    const account = await import('../lib/account');
    const sync = await import('../lib/sync');
    const dbm = await import('../lib/db');
    const { StateProbe } = await import('../test/state-probe');
    await dbm.db.settings.clear();
    await dbm.db.entries.clear();
    vi.spyOn(account, 'signIn').mockResolvedValue({ ok: true, session: SESSION });
    vi.spyOn(sync, 'mergePreview').mockResolvedValue({ local: 0, remote: 3, otherAccount: false });
    vi.spyOn(sync, 'syncDatabase').mockImplementation(syncResult as never);
    let latest: { bootAttempt: number; settings: { account: unknown } } | null = null;
    render(
      <StateProvider testState={{}}>
        <OnboardingScreen />
        <StateProbe onState={(st) => (latest = st)} />
      </StateProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to restore' }));
    fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'me@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'long enough pw' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    return { state: () => latest!, waitFor, dbm };
  }

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('is offered only when accounts are on', async () => {
    render(
      <StateProvider testState={{}}>
        <OnboardingScreen />
      </StateProvider>,
    );
    expect(screen.queryByRole('button', { name: 'Sign in to restore' })).not.toBeInTheDocument();
  });

  it('brings the account\u2019s logs back and skips setup', async () => {
    vi.stubEnv('VITE_ACCOUNTS', '1');
    const { dbm } = await import('../lib/db').then((m) => ({ dbm: m }));
    const { state, waitFor } = await signInToRestore(async () => {
      await dbm.db.entries.put({ date: '2026-10-20', flow: 'medium', symptoms: [], mood: null, note: '', updatedAt: 1 });
      await dbm.db.settings.put({ key: 'lastPeriodStart', value: '2026-10-20' });
      return { result: 'synced', changed: true, rejected: 0 };
    });
    await waitFor(() => expect(state().bootAttempt).toBe(1));
    expect((await dbm.db.settings.get('onboardingComplete'))?.value).toBe(true);
    expect((await dbm.db.settings.get('account'))?.value).toEqual(SESSION);
  });

  it('stays in setup, signed in, when the account has no logs', async () => {
    vi.stubEnv('VITE_ACCOUNTS', '1');
    const { state, waitFor, dbm } = await signInToRestore(async () => ({ result: 'synced', changed: false, rejected: 0 }));
    expect(await screen.findByText(/Your account has no logs yet/)).toBeInTheDocument();
    await waitFor(() => expect(state().settings.account).toEqual(SESSION));
    expect(state().bootAttempt).toBe(0);
    expect((await dbm.db.settings.get('onboardingComplete'))?.value).not.toBe(true);
  });

  it('says so when the server can\u2019t be reached', async () => {
    vi.stubEnv('VITE_ACCOUNTS', '1');
    await signInToRestore(async () => ({ result: 'offline' }));
    expect(await screen.findByText(/couldn't reach the server to restore/)).toBeInTheDocument();
  });
});

