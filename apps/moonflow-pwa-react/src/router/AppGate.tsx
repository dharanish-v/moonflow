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

import { lazy, type ReactNode, Suspense, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRenderMode } from '../hooks/useRenderMode';
import { useResolvedTheme } from '../hooks/useResolvedTheme';
import { PIN_RELOCK_AFTER_MINUTES } from '../lib/constants';
import { computeHomeStatus, type CyclePhase } from '../lib/home-status';
import { needsUnlock } from '../lib/pin-auth';
import { OnboardingScreen } from '../screens/Onboarding';
import { PinUnlockScreen } from '../screens/PinUnlock';
import { useAppState } from '../state/store';
import { SplashScreen } from './placeholders';

const WorldScene = lazy(() => import('../components/WorldScene'));

/** The privacy-gate logic itself, pulled out as a pure function so it's
 * directly unit-testable — WorldScene only ever mounts when renderMode is
 * 'canvas3d', which jsdom can never be (no real WebGL2), so a component-
 * level test could never observe this by rendering AppGate and inspecting
 * WorldScene's props. */
export function resolveWorldCyclePhase(
  ready: boolean,
  entries: Parameters<typeof computeHomeStatus>[0],
  settings: Parameters<typeof computeHomeStatus>[1],
  today?: Date,
): CyclePhase {
  if (!ready || !settings.lastPeriodStart) return 'unknown';
  return computeHomeStatus(entries, settings, today).cyclePhase;
}

/** Mounted only once unlocked+onboarded — records the last real route so a
 * later re-lock (backgrounding) can return here, not just to the original
 * deep link. */
function RouteTracker({ onRouteChange }: { onRouteChange: (path: string) => void }) {
  const location = useLocation();
  useEffect(() => {
    onRouteChange(`${location.pathname}${location.search}`);
  }, [location, onRouteChange]);
  return null;
}

export function AppGate({ children }: { children: ReactNode }) {
  const { booted, entries, settings } = useAppState();
  const navigate = useNavigate();
  // Applies the resolved .light class to <html> globally, regardless of
  // boot/lock/route state — theme is not privacy-sensitive, unlike
  // cyclePhase below, so it's fine to resolve before unlock.
  useResolvedTheme(settings.themeMode);
  // Gates WorldScene on real WebGL2 support, same as HomeScene always was —
  // not just a fallback-content decision (Phase 4 adds the real
  // StaticMoonFallback for this branch): jsdom has no ResizeObserver, which
  // R3F's Canvas needs internally, so mounting it unconditionally crashed
  // *every* test that renders AppGate, including ones with nothing to do
  // with the 3D scene (PIN lock, onboarding) — caught live by the existing
  // test suite, not assumed. useRenderMode() already resolves to 'fallback'
  // under jsdom for exactly this reason, so gating on it fixes both at once.
  const renderMode = useRenderMode();

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

  function handleUnlock() {
    const target = deepLinkTargetRef.current ?? lastRouteRef.current;
    deepLinkTargetRef.current = null;
    setIsLocked(false);
    navigate(target, { replace: true });
  }

  // A single return, not four early returns: WorldScene must render on
  // every one of these branches (splash/lock/onboarding/real app) — "every
  // screen is part of the world," including the lock screen — so it can't
  // live only in the last branch the way the old CycleSky did. Four
  // disjoint early-return trees would unmount/remount WorldScene's whole
  // WebGL context on every splash→lock→unlock→onboarding transition, the
  // same "Context Lost" failure this app already hit once from a Suspense
  // unmount (HomeScene.tsx's own file header). gatedContent is the part
  // that *does* still vary per branch, layered on top of WorldScene.
  const gatedContent =
    !booted || !hasResolvedLock ? (
      <SplashScreen />
    ) : isLocked ? (
      <PinUnlockScreen onUnlock={handleUnlock} />
    ) : !settings.onboardingComplete ? (
      <OnboardingScreen />
    ) : (
      <>
        <RouteTracker
          onRouteChange={(path) => {
            lastRouteRef.current = path;
          }}
        />
        {children}
      </>
    );

  // Privacy gate moves from *where* WorldScene mounts (impossible now — it
  // must render behind the lock screen too) to *what data* it's fed: real
  // cyclePhase only once actually unlocked, onboarded, and real period data
  // exists; 'unknown' otherwise (booting, locked, or onboarding
  // incomplete) — the same honest "no signal to show yet" state
  // computeHomeStatus itself already falls back to.
  const worldCyclePhase = resolveWorldCyclePhase(
    hasResolvedLock && !isLocked && settings.onboardingComplete,
    entries,
    settings,
  );

  return (
    <>
      {renderMode === 'canvas3d' && (
        <Suspense fallback={null}>
          <WorldScene cyclePhase={worldCyclePhase} />
        </Suspense>
      )}
      {gatedContent}
    </>
  );
}
