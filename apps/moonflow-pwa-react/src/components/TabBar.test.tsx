import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { TabBar } from './TabBar';

// TabBar renders a real Link for each of the 4 tabs regardless of which one
// is "current" — so, unlike the single-route renderRouted() helper other
// screen tests use, this test router needs all 4 real paths (plus /log, to
// prove the tab bar hides there) actually defined.
async function renderTabBar(initialPath: string) {
  const rootRoute = createRootRoute({ component: TabBar });
  const routes = ['/', '/calendar', '/insights', '/settings', '/log'].map((path) =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => null }),
  );
  const routeTree = rootRoute.addChildren(routes);
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [initialPath] }) });
  // Route matching resolves a tick after mount — without this, render()
  // returns before TabBar's route commits, and a synchronous getByRole()
  // right after sees an empty tree.
  await router.load();
  return render(<RouterProvider router={router} />);
}

describe('TabBar', () => {
  it('marks the active tab for the current route', async () => {
    await renderTabBar('/calendar');
    expect(screen.getByRole('link', { name: 'Calendar' })).toHaveClass('text-primary');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveClass('text-primary');
  });

  it('hides entirely on /log — no tab bar exists to make the sheet feel non-modal', async () => {
    await renderTabBar('/log');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('every tab meets the 44px touch target minimum (ADR-024) — not the vanilla app\'s original 19px icons', async () => {
    await renderTabBar('/');
    for (const link of screen.getAllByRole('link')) {
      expect(link).toHaveClass('size-11');
    }
  });

  it('has no accessibility violations', async () => {
    const { container } = await renderTabBar('/');
    expect(await axe(container)).toHaveNoViolations();
  });
});
