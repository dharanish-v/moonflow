import 'fake-indexeddb/auto';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { SETTINGS_DEFAULTS } from '../lib/db';
import { StateProvider } from '../state/store';
import { PinUnlockScreen } from './PinUnlock';

describe('PinUnlockScreen', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(
      <StateProvider testState={{ settings: { ...SETTINGS_DEFAULTS, pinHash: 'abc', pinLockEnabled: true } }}>
        <PinUnlockScreen onUnlock={vi.fn()} />
      </StateProvider>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
