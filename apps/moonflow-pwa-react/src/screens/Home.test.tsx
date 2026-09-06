import 'fake-indexeddb/auto';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { HashRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SETTINGS_DEFAULTS } from '../lib/db';
import { StateProvider } from '../state/store';
import { HomeScreen } from './Home';

describe('HomeScreen', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(
      <HashRouter>
        {/* lastPeriodStart is never actually null once onboarded — onboarding
            always sets a real date first — so give it one here too. */}
        <StateProvider testState={{ settings: { ...SETTINGS_DEFAULTS, lastPeriodStart: '2026-08-10' } }}>
          <HomeScreen />
        </StateProvider>
      </HashRouter>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
