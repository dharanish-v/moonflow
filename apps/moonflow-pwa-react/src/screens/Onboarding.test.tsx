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
