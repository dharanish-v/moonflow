// src/test/render-with-router.tsx — a throwaway single-route router per
// test, not the real app's routeTree. Most screen tests only need
// useNavigate()/useSearch() to not throw, not real multi-route matching —
// AppGate.test.tsx is the one exception that builds the real routeTree
// directly, since it's specifically testing route-to-route behavior.
import type { ReactElement, ReactNode } from 'react';
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { render } from '@testing-library/react';

export async function renderRouted(
  element: ReactElement,
  opts: {
    path?: string;
    initialEntries?: string[];
    validateSearch?: (search: Record<string, unknown>) => unknown;
    /** Wraps the whole router (e.g. a StateProvider that must outlive navigation). */
    wrapper?: (children: ReactNode) => ReactElement;
  } = {},
) {
  const { path = '/', initialEntries = [path], validateSearch, wrapper } = opts;
  // Any navigation away from the route under test lands on a blank stub
  // instead of a not-found error.
  const rootRoute = createRootRoute({ notFoundComponent: () => null });
  const testRoute = createRoute({
    getParentRoute: () => rootRoute,
    path,
    validateSearch,
    component: () => element,
  });
  const routeTree = rootRoute.addChildren([testRoute]);
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries }) });
  // Route matching (even with no loaders) resolves a tick after mount —
  // without this, render() returns before the route's component commits,
  // and a synchronous getByRole() right after sees an empty tree.
  await router.load();
  const app = <RouterProvider router={router} />;
  return { ...render(wrapper ? wrapper(app) : app), router };
}
