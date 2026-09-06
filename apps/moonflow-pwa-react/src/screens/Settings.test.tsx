import 'fake-indexeddb/auto';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { renderRouted } from '../test/render-with-router';
import { StateProvider } from '../state/store';
import { SettingsScreen } from './Settings';

describe('SettingsScreen', () => {
  it('has no accessibility violations', async () => {
    const { container } = await renderRouted(
      <StateProvider testState={{}}>
        <SettingsScreen />
      </StateProvider>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
