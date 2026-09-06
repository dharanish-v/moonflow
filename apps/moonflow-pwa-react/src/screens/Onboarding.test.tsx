import 'fake-indexeddb/auto';
import { render } from '@testing-library/react';
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
});
