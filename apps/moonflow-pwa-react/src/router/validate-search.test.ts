import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateLogSearch } from './router';

describe('validateLogSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 25, 10));
  });
  afterEach(() => vi.useRealTimers());

  it('keeps a real past or current date', () => {
    expect(validateLogSearch({ date: '2026-09-25' })).toEqual({ date: '2026-09-25', from: undefined });
    expect(validateLogSearch({ date: '2025-01-31', from: 'calendar' })).toEqual({ date: '2025-01-31', from: 'calendar' });
    expect(validateLogSearch({ from: 'evil' }).from).toBeUndefined();
  });

  it('drops a malformed, impossible, or future date (falls back to today)', () => {
    for (const date of ['banana', '2026-02-30', '2026-09-26', '2099-01-01', 42]) {
      expect(validateLogSearch({ date }).date, String(date)).toBeUndefined();
    }
  });
});
