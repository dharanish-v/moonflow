// src/test/setup.ts — Vitest global setup, run before every test file.
import '@testing-library/jest-dom/vitest';
import { expect } from 'vitest';
import { toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

// jsdom has no matchMedia at all — every real browser does, so this is a
// test-environment gap, not app-code defensiveness. framer-motion's own
// useReducedMotion() already guards `if (window.matchMedia)` internally and
// degrades gracefully; code that calls matchMedia directly (useRenderMode)
// needs this polyfill or it throws in an effect with no error boundary,
// silently unmounting the whole tree.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
