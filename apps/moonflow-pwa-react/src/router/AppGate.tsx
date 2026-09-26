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

import { type ReactNode, Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useLocation, useRouter } from '@tanstack/react-router';
import { useResolvedTheme } from '../hooks/useResolvedTheme';
import { PIN_RELOCK_AFTER_MINUTES } from '../lib/constants';
import { needsUnlock } from '../lib/pin-auth';
import { switchDatabase } from '../lib/db';
import { PinUnlockScreen } from '../screens/PinUnlock';
import { useAppDispatch, useAppState } from '../state/hooks';
import { BootErrorScreen, SplashScreen } from './placeholders';

// First run only — keeps the date-picker library out of every later launch.
const OnboardingScreen = lazy(() => import('../screens/Onboarding').then((m) => ({ default: m.OnboardingScreen })));

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

  // null = not resolved yet. Resolved exactly once per boot, not on every
  // settings change, so turning the PIN lock on in Settings doesn't itself
  // lock the screen (re-locking is the Page Visibility behaviour below).
  // Resolved during render (React's "adjust state from props" pattern)
  // rather than in an effect.
  const [isLocked, setIsLocked] = useState<boolean | null>(null);
  // The deep link the app was opened with — read from the raw hash at mount,
  // before any route can mount or the router can diverge from it.
  const [initialHash] = useState(() => window.location.hash.replace(/^#/, '') || '/');
  const [deepLinkTarget, setDeepLinkTarget] = useState<string | null>(null);
  const lastRouteRef = useRef('/');

  if (booted && isLocked === null) {
    const locked = needsUnlock(settings);
    setIsLocked(locked);
    if (locked) setDeepLinkTarget(initialHash);
  }
  const hasResolvedLock = isLocked !== null;

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
    setIsLocked(null);
    dispatch({ type: 'BOOT_RETRY' });
  }

  async function handleUnlock(kind: 'real' | 'duress' = 'real') {
    const target = deepLinkTarget ?? lastRouteRef.current;
    setDeepLinkTarget(null);
    if (kind === 'duress') {
      // Swap to the decoy database and re-read from it; the real data is
      // never loaded into this session again until the app is relaunched.
      await switchDatabase('decoy');
      dispatch({ type: 'BOOT_RETRY' });
    }
    setIsLocked(false);
    // A raw href string (possibly with a query string) restored from either
    // a pre-unlock deep link or the last route visited before locking —
    // not a type-safe `to`+`search` pair, so this goes through the history
    // adapter directly rather than useNavigate().
    router.history.replace(target);
  }

  if (bootError) return <Frame><BootErrorScreen onRetry={() => dispatch({ type: 'BOOT_RETRY' })} /></Frame>;
  if (!booted || !hasResolvedLock) return <Frame><SplashScreen /></Frame>;
  if (isLocked) return <Frame><PinUnlockScreen onUnlock={(kind) => void handleUnlock(kind)} onErased={handleErased} /></Frame>;
  if (!settings.onboardingComplete) {
    return (
      <Frame>
        <Suspense fallback={<SplashScreen />}>
          <OnboardingScreen />
        </Suspense>
      </Frame>
    );
  }

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
