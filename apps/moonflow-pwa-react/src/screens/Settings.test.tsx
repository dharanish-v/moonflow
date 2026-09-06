import 'fake-indexeddb/auto';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { HashRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { StateProvider } from '../state/store';
import { SettingsScreen } from './Settings';

describe('SettingsScreen', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(
      <HashRouter>
        <StateProvider testState={{}}>
          <SettingsScreen />
        </StateProvider>
      </HashRouter>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
