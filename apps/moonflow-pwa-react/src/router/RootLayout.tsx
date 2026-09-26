// src/router/RootLayout.tsx — the root route's components, kept apart from
// router.tsx so that file exports only route objects (fast refresh).
import { Navigate, Outlet } from '@tanstack/react-router';
import { TabBar } from '../components/TabBar';
import { AppGate } from './AppGate';

// #app-content wraps AppGate (every branch: splash/lock/onboarding/real
// screens all get its padding + flex-column treatment uniformly) and is the
// one element that actually scrolls (index.css). TabBar sits as its
// *sibling*, not its child — real bug, caught live: with TabBar nested
// inside the scrolling box, it visually scrolled away with the content
// instead of staying pinned, invisible on every screen until one had
// content tall enough to actually scroll (Insights' recent-logs list was
// the first).
export function RootLayout() {
  return (
    <AppGate tabBar={<TabBar />}>
      <Outlet />
    </AppGate>
  );
}

/** An unrecognized hash (hand-edited, or a stale deep link) lands on Home. */
export function NotFound() {
  return <Navigate to="/" replace />;
}
