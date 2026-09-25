import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { usePrivacyScreen } from './usePrivacyScreen';

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('usePrivacyScreen', () => {
  afterEach(() => setHidden(false));

  it('covers the app the moment it is backgrounded, so the app-switcher snapshot shows nothing', () => {
    renderHook(() => usePrivacyScreen());
    act(() => setHidden(true));
    expect(document.documentElement.classList.contains('privacy-cover')).toBe(true);
  });

  it('uncovers it on return', () => {
    renderHook(() => usePrivacyScreen());
    act(() => setHidden(true));
    act(() => setHidden(false));
    expect(document.documentElement.classList.contains('privacy-cover')).toBe(false);
  });

  it('also covers on pagehide (iOS may snapshot before visibilitychange)', () => {
    renderHook(() => usePrivacyScreen());
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(document.documentElement.classList.contains('privacy-cover')).toBe(true);
    act(() => {
      window.dispatchEvent(new Event('pageshow'));
    });
    expect(document.documentElement.classList.contains('privacy-cover')).toBe(false);
  });
});
