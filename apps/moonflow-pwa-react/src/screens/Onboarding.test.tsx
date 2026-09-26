import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
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
