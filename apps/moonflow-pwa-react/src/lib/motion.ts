// src/lib/motion.ts — platform motion (T87), replacing framer-motion:
// View Transitions for state changes, CSS keyframes for ambient motion
// (index.css), the Web Animations API for one-off gestures. Everything
// yields to the OS "Reduce Motion" setting.
import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => {};
      const mq = window.matchMedia(QUERY);
      mq.addEventListener?.('change', onChange);
      return () => mq.removeEventListener?.('change', onChange);
    },
    prefersReducedMotion,
    () => false,
  );
}

type WithVT = Document & { startViewTransition?: (update: () => void) => unknown };

/** Runs `update` as a view transition where supported (Safari 18+), so the
 * browser cross-fades/slides between the old and new DOM. Falls back to a
 * plain update. */
export function withViewTransition(update: () => void) {
  const doc = document as WithVT;
  if (!doc.startViewTransition || prefersReducedMotion()) {
    update();
    return;
  }
  doc.startViewTransition(update);
}

/** Wrong-PIN shake. */
export function shake(el: HTMLElement) {
  if (prefersReducedMotion() || typeof el.animate !== 'function') return;
  el.animate(
    [0, 8, -8, 8, -8, 8, -8, 0].map((x) => ({ transform: `translateX(${x}px)` })),
    { duration: 420, easing: 'ease-in-out' },
  );
}
