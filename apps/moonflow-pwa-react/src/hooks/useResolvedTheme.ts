// src/hooks/useResolvedTheme.ts — ADR-034. Resolves Settings.themeMode
// ('system' | 'light' | 'dark') against the OS/browser's own
// prefers-color-scheme when 'system', and applies the result as a real
// `.light` class on <html> — not `.dark`: this app's :root has always
// *been* the dark palette (design-system.md's original dark-only stance),
// so the new light theme is the one that needs an override class, not the
// other way around. Absence of `.light` (the pre-existing default) keeps
// every current dark-mode user's rendering byte-for-byte unchanged.
import { useEffect, useState } from 'react';
import type { ThemeMode } from '../lib/types';

export type ResolvedTheme = 'light' | 'dark';

/** Mirrors --background in index.css. */
const THEME_BACKGROUND: Record<ResolvedTheme, string> = { dark: '#14132B', light: '#F7F5EF' };

function resolveSystemPreference(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function useResolvedTheme(themeMode: ThemeMode): ResolvedTheme {
  const [systemPreference, setSystemPreference] = useState<ResolvedTheme>(resolveSystemPreference);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => setSystemPreference(resolveSystemPreference());
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolved: ResolvedTheme = themeMode === 'system' ? systemPreference : themeMode;

  useEffect(() => {
    document.documentElement.classList.toggle('light', resolved === 'light');
    // Remembered for public/theme-boot.js, which applies it on the next
    // launch before React (and IndexedDB) load.
    try {
      localStorage.setItem('theme', themeMode);
    } catch {
      // private mode / storage blocked: only the launch flash comes back
    }
    // Browser UI tint (Safari tab bar, Android status bar) follows the theme.
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_BACKGROUND[resolved]);
    // The launch shell's first-frame background (index.html / theme-boot.js).
    document.documentElement.style.background = THEME_BACKGROUND[resolved];
  }, [resolved, themeMode]);

  return resolved;
}
