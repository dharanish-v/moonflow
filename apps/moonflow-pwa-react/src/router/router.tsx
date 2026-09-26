// src/router/router.tsx — the TanStack Router route tree. Code-based
// routing (not file-based) — this app's route list is small and fixed, so a
// generated route tree would be pure overhead. Same GitHub-Pages-safe hash
// approach as before (a pretty path 404s on a static host with no rewrite
// rule; a hash never reaches the server), via createHashHistory below.
//
// AppGate is the root route's own component, not a separate wrapper App.tsx
// reaches for — RouterProvider renders starting at the root route, so this
// is the one place that can sit "around" every screen (splash/lock/
// onboarding vs. the real Outlet) while still being inside router context.
import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from '@tanstack/react-router';
// Home is the launch screen and stays in the main bundle; everything else
// loads on first visit (T62).
import { HomeScreen } from '../screens/Home';
import { NotFound, RootLayout } from './RootLayout';
import { isFutureDate, isRealDate } from '../lib/dates';
import { FLOW_OPTIONS, SYMPTOM_OPTIONS } from '../lib/constants';
import type { FlowId, SymptomId } from '../lib/types';
import { AppErrorScreen } from './placeholders';

export const rootRoute = createRootRoute({
  component: RootLayout,
  // Mirrors the old <Route path="*" element={<Navigate to="/" replace />} />
  // catch-all — an unrecognized hash (hand-edited, or a stale deep link)
  // lands on Home instead of a blank error screen.
  notFoundComponent: NotFound,
  errorComponent: AppErrorScreen,
});

export interface HomeSearch {
  /** Set by LogEntry's Save when it lands back on Home fresh (no prior
   * entry for that date) — a one-shot "just logged" signal Home reads once
   * to show an acknowledgment, then clears from the URL itself (see
   * Home.tsx) so a later refresh/revisit never replays it. */
  /** 'prediction' when period flow was saved (the prediction moved), 'saved' otherwise. */
  justLogged?: 'prediction' | 'saved';
}

/** Mirrors validateLogSearch's own defensive style below — a boolean should
 * round-trip as a real boolean through the router's search serializer, but
 * accept the stringified form too rather than assume. */
export function validateHomeSearch(search: Record<string, unknown>): HomeSearch {
  return {
    justLogged:
      search.justLogged === 'saved'
        ? 'saved'
        : search.justLogged === 'prediction' || search.justLogged === true || search.justLogged === 'true'
          ? 'prediction'
          : undefined,
  };
}

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: validateHomeSearch,
  component: HomeScreen,
});
const calendarRoute = createRoute({ getParentRoute: () => rootRoute, path: '/calendar', component: lazyRouteComponent(() => import('../screens/Calendar'), 'CalendarScreen') });
const insightsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/insights', component: lazyRouteComponent(() => import('../screens/Insights'), 'InsightsScreen') });
const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/settings', component: lazyRouteComponent(() => import('../screens/Settings'), 'SettingsScreen') });
const pinSetupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings/pin-setup',
  component: lazyRouteComponent(() => import('../screens/PinSetup'), 'PinSetupScreen'),
});

export type LogOrigin = 'home' | 'calendar' | 'insights';

export interface LogSearch {
  date?: string;
  /** Where the sheet was opened from — closing/saving returns there. */
  from?: LogOrigin;
  /** Shortcut links (T83): pre-select a flow / a symptom, e.g. from an iOS
   * Shortcut or the Action Button — `#/log?flow=medium&symptom=cramps`. */
  flow?: FlowId;
  symptom?: SymptomId;
}

const LOG_ORIGINS: ReadonlySet<string> = new Set(['home', 'calendar', 'insights']);

// Exported (not inlined into logRoute below) so tests can build their own
// throwaway '/log' route without duplicating this shape.
/** Only a real, non-future day can be logged — `?date=banana` used to save
 * a row keyed "banana" that turned Insights into NaN, and future dates
 * (which Calendar disables) were reachable by URL. Anything else falls back
 * to today. */
export function validateLogSearch(search: Record<string, unknown>): LogSearch {
  return {
    date: isRealDate(search.date) && !isFutureDate(search.date) ? search.date : undefined,
    from: typeof search.from === 'string' && LOG_ORIGINS.has(search.from) ? (search.from as LogOrigin) : undefined,
    flow: FLOW_OPTIONS.some((f) => f.id === search.flow) ? (search.flow as FlowId) : undefined,
    symptom: SYMPTOM_OPTIONS.some((o) => o.id === search.symptom) ? (search.symptom as SymptomId) : undefined,
  };
}

export interface PinVerifySearch {
  intent: 'disable' | 'change';
}

export function validatePinVerifySearch(search: Record<string, unknown>): PinVerifySearch {
  return { intent: search.intent === 'change' ? 'change' : 'disable' };
}

const pinVerifyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings/pin-verify',
  validateSearch: validatePinVerifySearch,
  component: lazyRouteComponent(() => import('../screens/PinVerify'), 'PinVerifyScreen'),
});

const duressSetupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings/duress-setup',
  component: lazyRouteComponent(() => import('../screens/DuressSetup'), 'DuressSetupScreen'),
});

const reportRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/insights/report',
  component: lazyRouteComponent(() => import('../screens/Report'), 'ReportScreen'),
});

const logRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/log',
  validateSearch: validateLogSearch,
  component: lazyRouteComponent(() => import('../screens/LogEntry'), 'LogEntryScreen'),
});

export const routeTree = rootRoute.addChildren([
  indexRoute,
  calendarRoute,
  insightsRoute,
  settingsRoute,
  pinSetupRoute,
  pinVerifyRoute,
  duressSetupRoute,
  reportRoute,
  logRoute,
]);

/** A factory, not a shared singleton — tests each need their own isolated
 * router/history instance; production calls this once (see App.tsx). */
export function createAppRouter() {
  return createRouter({ routeTree, history: createHashHistory() });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
