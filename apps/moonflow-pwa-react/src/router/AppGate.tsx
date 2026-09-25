// src/router/AppGate.tsx — the lock/onboarding security gate. Structurally
// stronger than the vanilla app's imperative popstate bail-out: while
// isLocked, <Routes> is not mounted at all, so there is no route component
// for back/forward to reveal.
//
// settings.pinLockEnabled ("is the feature on", persisted) and isLocked
// ("is the lock screen showing right now", transient/session-only) are two
// separate booleans on purpose — conflating them was the exact bug this
// rewrite's vanilla-JS predecessor shipped and had to fix (re-locking on
// every back/forward press even after a correct unlock).

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useLocation, useRouter } from '@tanstack/react-router';
import { useResolvedTheme } from '../hooks/useResolvedTheme';
import { PIN_RELOCK_AFTER_MINUTES } from '../lib/constants';
import { needsUnlock } from '../lib/pin-auth';
import { OnboardingScreen } from '../screens/Onboarding';
import { PinUnlockScreen } from '../screens/PinUnlock';
import { useAppDispatch, useAppState } from '../state/store';
import { BootErrorScreen, SplashScreen } from './placeholders';

/** Mounted only once unlocked+onboarded — records the last real route so a
 * later re-lock (backgrounding) can return here, not just to the original
 * deep link. */
function RouteTracker({ onRouteChange }: { onRouteChange: (href: string) => void }) {
  const location = useLocation();
  useEffect(() => {
    onRouteChange(location.href);
  }, [location, onRouteChange]);
  return null;
}

/** #app-content is the one scrolling element; TabBar must sit beside it,
 * not inside it (see router.tsx). AppGate owns both so the tab bar only
 * exists once the gate is open — rendered over the lock screen, it used to
 * navigate the (unmounted) routes behind it. */
function Frame({ children, tabBar }: { children: ReactNode; tabBar?: ReactNode }) {
  return (
    <>
      <main id="app-content">{children}</main>
      {tabBar}
    </>
  );
}

export function AppGate({ children, tabBar }: { children: ReactNode; tabBar?: ReactNode }) {
  const { booted, bootError, settings } = useAppState();
  const dispatch = useAppDispatch();
  const router = useRouter();
  // Applies the resolved .light/.dark class to <html> — shadcn's theme
  // system reads these tokens; this is the only thing deciding which set
  // is active.
  useResolvedTheme(settings.themeMode);

  const [hasResolvedLock, setHasResolvedLock] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const deepLinkTargetRef = useRef<string | null>(null);
  const lastRouteRef = useRef('/');

  // Resolve the lock state exactly once, right after boot — not on every
  // settings change, so toggling the PIN-lock feature in Settings doesn't
  // itself trigger a re-lock (that's the distinct Page Visibility behavior
  // below).
  useEffect(() => {
    if (!booted || hasResolvedLock) return;
    const locked = needsUnlock(settings);
    if (locked) {
      // Read the raw hash directly — before Routes ever mounts and before
      // the router can diverge from it (back/forward-mashing while locked).
      // Deliberately not useLocation() here; see file header.
      deepLinkTargetRef.current = window.location.hash.replace(/^#/, '') || '/';
    }
    setIsLocked(locked);
    setHasResolvedLock(true);
  }, [booted, hasResolvedLock, settings]);

  // Re-lock after PIN_RELOCK_AFTER_MINUTES spent backgrounded (Page Visibility API).
  useEffect(() => {
    if (!hasResolvedLock) return;
    let hiddenAt: number | null = null;
    function onVisibilityChange() {
      if (document.hidden) {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt === null) return;
      const minutesHidden = (Date.now() - hiddenAt) / 60000;
      hiddenAt = null;
      if (minutesHidden >= PIN_RELOCK_AFTER_MINUTES && needsUnlock(settings)) {
        setIsLocked(true);
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [hasResolvedLock, settings]);

  /** Forgot-PIN erase finished: drop the lock and re-read the (now empty)
   * database, which lands on onboarding. */
  function handleErased() {
    setIsLocked(false);
    setHasResolvedLock(false);
    dispatch({ type: 'BOOT_RETRY' });
  }

  function handleUnlock() {
    const target = deepLinkTargetRef.current ?? lastRouteRef.current;
    deepLinkTargetRef.current = null;
    setIsLocked(false);
    // A raw href string (possibly with a query string) restored from either
    // a pre-unlock deep link or the last route visited before locking —
    // not a type-safe `to`+`search` pair, so this goes through the history
    // adapter directly rather than useNavigate().
    router.history.replace(target);
  }

  if (bootError) return <Frame><BootErrorScreen onRetry={() => dispatch({ type: 'BOOT_RETRY' })} /></Frame>;
  if (!booted || !hasResolvedLock) return <Frame><SplashScreen /></Frame>;
  if (isLocked) return <Frame><PinUnlockScreen onUnlock={handleUnlock} onErased={handleErased} /></Frame>;
  if (!settings.onboardingComplete) return <Frame><OnboardingScreen /></Frame>;

  return (
    <Frame tabBar={tabBar}>
      <RouteTracker
        onRouteChange={(href) => {
          lastRouteRef.current = href;
        }}
      />
      {children}
    </Frame>
  );
}
