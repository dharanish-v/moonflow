import { describe, expect, it } from 'vitest';
import { isRealDate } from './dates';

describe('isRealDate', () => {
  it('accepts a real calendar date', () => {
    expect(isRealDate('2026-02-28')).toBe(true);
    expect(isRealDate('2028-02-29')).toBe(true); // leap year
  });

  it('rejects impossible or malformed dates', () => {
    for (const bad of ['2026-02-30', '2026-02-29', '2026-13-01', '2026-00-10', 'banana', '2026-9-1', '', '2026-09-06T00:00']) {
      expect(isRealDate(bad), bad).toBe(false);
    }
  });
});
