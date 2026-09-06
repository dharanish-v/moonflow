// @ts-check
// router.js — hand-rolled hash-based routing (~30 lines, matches store.js's
// own no-library philosophy — ADR-007). Hash, not pushState pretty paths:
// this app deploys to GitHub Pages and any other static host with zero
// server-side rewrite config (design-system.md's Tech Stack table: "any
// static host... no server code to run"), so a direct link or hard refresh
// at a pretty path like /calendar would 404 outright — nothing server-side
// exists to fall back to index.html. A hash fragment never reaches the
// server at all, so index.html always loads first regardless of which
// screen's URL was shared, bookmarked, or refreshed.
//
// pin-lock and onboarding are deliberately NOT routable screens — see their
// handling in app.js: they're security/setup gates, not destinations, and
// giving pin-lock a URL would let the browser's own back/forward button be
// used to attempt bypassing the lock.

const SCREEN_TO_PATH = /** @type {Record<string, string>} */ ({
  home: '',
  calendar: 'calendar',
  insights: 'insights',
  settings: 'settings',
  log: 'log'
});

const PATH_TO_SCREEN = /** @type {Record<string, string>} */ ({ '': 'home' });
for (const [screen, path] of Object.entries(SCREEN_TO_PATH)) {
  if (path) PATH_TO_SCREEN[path] = screen;
}

/**
 * @param {string} screen
 * @param {{date?: string|null, focus?: string|null}} [params]
 */
export function buildHash(screen, params = {}) {
  const path = SCREEN_TO_PATH[screen];
  if (path === undefined) return '#/';
  const query = new URLSearchParams();
  if (params.date) query.set('date', params.date);
  if (params.focus) query.set('focus', params.focus);
  const qs = query.toString();
  return `#/${path}${qs ? `?${qs}` : ''}`;
}

/** Reads the current location.hash into a screen name + params, falling back to home on anything unrecognized. */
export function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  const screen = PATH_TO_SCREEN[path] ?? 'home';
  const params = Object.fromEntries(new URLSearchParams(qs || ''));
  return { screen, params };
}
