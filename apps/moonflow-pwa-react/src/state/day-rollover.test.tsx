import 'fake-indexeddb/auto';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppState } from './actions';
import { StateProvider } from './store';
import { StateProbe } from '../test/state-probe';

describe('StateProvider keeps "today" current', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(2026, 8, 26, 23, 59, 30));
  });
  afterEach(() => vi.useRealTimers());

  it('rolls over at midnight while the app stays open', () => {
    let latest: AppState | null = null;
    render(
      <StateProvider testState={{}}>
        <StateProbe onState={(s) => (latest = s)} />
      </StateProvider>,
    );
    expect(latest!.today).toBe('2026-09-26');
    act(() => {
      vi.setSystemTime(new Date(2026, 8, 27, 0, 0, 5));
      vi.advanceTimersByTime(60_000);
    });
    expect(latest!.today).toBe('2026-09-27');
  });

  it('catches up when the app is resumed the next morning', () => {
    let latest: AppState | null = null;
    render(
      <StateProvider testState={{}}>
        <StateProbe onState={(s) => (latest = s)} />
      </StateProvider>,
    );
    act(() => {
      vi.setSystemTime(new Date(2026, 8, 27, 8, 0));
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(latest!.today).toBe('2026-09-27');
  });
});
