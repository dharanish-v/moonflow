import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useResolvedTheme } from './useResolvedTheme';

describe('useResolvedTheme', () => {
  it('keeps <meta name="theme-color"> in step with the resolved theme', () => {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = '#000000';
    document.head.appendChild(meta);

    const { rerender } = renderHook(({ mode }) => useResolvedTheme(mode), { initialProps: { mode: 'light' as const } as { mode: 'light' | 'dark' } });
    expect(meta.content).toBe('#F7F5EF');
    rerender({ mode: 'dark' });
    expect(meta.content).toBe('#14132B');
    meta.remove();
  });
});
