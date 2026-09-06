import 'fake-indexeddb/auto';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { SETTINGS_DEFAULTS } from '../lib/db';
import { renderRouted } from '../test/render-with-router';
import { StateProvider } from '../state/store';
import { CalendarScreen } from './Calendar';

describe('CalendarScreen', () => {
  it('has no accessibility violations', async () => {
    const { container } = await renderRouted(
      // lastPeriodStart is never actually null once onboarded — onboarding
      // always sets a real date first — so give it one here too.
      <StateProvider testState={{ settings: { ...SETTINGS_DEFAULTS, lastPeriodStart: '2026-08-10' } }}>
        <CalendarScreen />
      </StateProvider>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
