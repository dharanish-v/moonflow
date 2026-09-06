import { describe, expect, it } from 'vitest';
import { classifyPerfTier } from './perf-tier';

describe('classifyPerfTier', () => {
  it('classifies a known-weak mobile GPU as low regardless of memory/cores', () => {
    expect(classifyPerfTier(8, 8, 'Adreno (TM) 308')).toBe('low');
    expect(classifyPerfTier(8, 8, 'Mali-400 MP')).toBe('low');
  });

  it('classifies low memory or few cores as low', () => {
    expect(classifyPerfTier(2, 8, null)).toBe('low');
    expect(classifyPerfTier(8, 2, null)).toBe('low');
  });

  it('classifies high memory and many cores with no weak-GPU match as high', () => {
    expect(classifyPerfTier(8, 8, 'Apple GPU')).toBe('high');
  });

  it('falls back to medium otherwise', () => {
    expect(classifyPerfTier(4, 4, null)).toBe('medium');
    expect(classifyPerfTier(4, 4, 'Adreno (TM) 740')).toBe('medium');
  });
});
