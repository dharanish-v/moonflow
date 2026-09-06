import 'fake-indexeddb/auto';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { validateLogSearch } from '../router/router';
import { renderRouted } from '../test/render-with-router';
import { StateProvider } from '../state/store';
import { LogEntryScreen } from './LogEntry';

describe('LogEntryScreen', () => {
  it('has no accessibility violations', async () => {
    const { container } = await renderRouted(
      <StateProvider testState={{}}>
        <LogEntryScreen />
      </StateProvider>,
      { path: '/log', initialEntries: ['/log?date=2026-09-06'], validateSearch: validateLogSearch },
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
