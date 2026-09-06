import 'fake-indexeddb/auto';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { HashRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { StateProvider } from '../state/store';
import { LogEntryScreen } from './LogEntry';

describe('LogEntryScreen', () => {
  it('has no accessibility violations', async () => {
    window.location.hash = '#/log?date=2026-09-06';
    const { container } = render(
      <HashRouter>
        <StateProvider testState={{}}>
          <LogEntryScreen />
        </StateProvider>
      </HashRouter>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
