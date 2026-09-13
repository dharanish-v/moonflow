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
import { Navigate, Outlet, createHashHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { TabBar } from '../components/TabBar';
import { CalendarScreen } from '../screens/Calendar';
import { HomeScreen } from '../screens/Home';
import { InsightsScreen } from '../screens/Insights';
import { LogEntryScreen } from '../screens/LogEntry';
import { PinSetupScreen } from '../screens/PinSetup';
import { SettingsScreen } from '../screens/Settings';
import { AppGate } from './AppGate';

// #app-content wraps AppGate (every branch: splash/lock/onboarding/real
// screens all get its padding + flex-column treatment uniformly) and is the
// one element that actually scrolls (index.css). TabBar sits as its
// *sibling*, not its child — real bug, caught live: with TabBar nested
// inside the scrolling box, it visually scrolled away with the content
// instead of staying pinned, invisible on every screen until one had
// content tall enough to actually scroll (Insights' recent-logs list was
// the first).
function RootLayout() {
  return (
    <>
      <main id="app-content">
        <AppGate>
          <Outlet />
        </AppGate>
      </main>
      <TabBar />
    </>
  );
}

export const rootRoute = createRootRoute({
  component: RootLayout,
  // Mirrors the old <Route path="*" element={<Navigate to="/" replace />} />
  // catch-all — an unrecognized hash (hand-edited, or a stale deep link)
  // lands on Home instead of a blank error screen.
  notFoundComponent: () => <Navigate to="/" replace />,
});

export interface HomeSearch {
  /** Set by LogEntry's Save when it lands back on Home fresh (no prior
   * entry for that date) — a one-shot "just logged" signal Home reads once
   * to show an acknowledgment, then clears from the URL itself (see
   * Home.tsx) so a later refresh/revisit never replays it. */
  justLogged?: boolean;
}

/** Mirrors validateLogSearch's own defensive style below — a boolean should
 * round-trip as a real boolean through the router's search serializer, but
 * accept the stringified form too rather than assume. */
export function validateHomeSearch(search: Record<string, unknown>): HomeSearch {
  return {
    justLogged: search.justLogged === true || search.justLogged === 'true' ? true : undefined,
  };
}

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: validateHomeSearch,
  component: HomeScreen,
});
const calendarRoute = createRoute({ getParentRoute: () => rootRoute, path: '/calendar', component: CalendarScreen });
const insightsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/insights', component: InsightsScreen });
const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/settings', component: SettingsScreen });
const pinSetupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings/pin-setup',
  component: PinSetupScreen,
});

export interface LogSearch {
  date?: string;
}

// Exported (not inlined into logRoute below) so tests can build their own
// throwaway '/log' route without duplicating this shape.
export function validateLogSearch(search: Record<string, unknown>): LogSearch {
  return {
    date: typeof search.date === 'string' ? search.date : undefined,
  };
}

const logRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/log',
  validateSearch: validateLogSearch,
  component: LogEntryScreen,
});

export const routeTree = rootRoute.addChildren([
  indexRoute,
  calendarRoute,
  insightsRoute,
  settingsRoute,
  pinSetupRoute,
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
