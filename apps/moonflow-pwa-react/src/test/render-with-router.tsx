// src/test/render-with-router.tsx — a throwaway single-route router per
// test, not the real app's routeTree. Most screen tests only need
// useNavigate()/useSearch() to not throw, not real multi-route matching —
// AppGate.test.tsx is the one exception that builds the real routeTree
// directly, since it's specifically testing route-to-route behavior.
import type { ReactElement } from 'react';
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { render } from '@testing-library/react';

export async function renderRouted(
  element: ReactElement,
  opts: {
    path?: string;
    initialEntries?: string[];
    validateSearch?: (search: Record<string, unknown>) => unknown;
  } = {},
) {
  const { path = '/', initialEntries = [path], validateSearch } = opts;
  const rootRoute = createRootRoute();
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
  return render(<RouterProvider router={router} />);
}
