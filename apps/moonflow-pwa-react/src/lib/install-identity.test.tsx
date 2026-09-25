import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { OnboardingScreen } from '../screens/Onboarding';
import { StateProvider } from '../state/store';
import { appName, isDiscreetInstall } from './install-identity';
import { parseImportPayload } from './import';

describe('discreet install identity', () => {
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('detects the planner.html entry', () => {
    expect(isDiscreetInstall('/moonflow/planner.html')).toBe(true);
    expect(isDiscreetInstall('/moonflow/index.html')).toBe(false);
    expect(appName('/moonflow/planner.html')).toBe('Planner');
    expect(appName('/moonflow/')).toBe('Moonflow');
  });

  it('onboarding never says "Moonflow" in the discreet install', () => {
    window.history.replaceState(null, '', '/moonflow/planner.html');
    const { container } = render(
      <StateProvider testState={{}}>
        <OnboardingScreen />
      </StateProvider>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("Let's get set up");
    expect(container.textContent).not.toMatch(/moonflow/i);
  });

  it('import errors never name the app', () => {
    const r = parseImportPayload(JSON.stringify({ hello: 1 }));
    expect(r.ok === false && r.error).not.toMatch(/moonflow/i);
  });
});
