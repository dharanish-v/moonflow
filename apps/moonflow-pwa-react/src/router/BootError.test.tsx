// A failed IndexedDB read at boot must never look like a first run: showing
// onboarding would let the user overwrite their real settings, and a
// defaulted pinLockEnabled=false would show their data with no PIN.
import 'fake-indexeddb/auto';
import { RouterProvider, createHashHistory, createRouter } from '@tanstack/react-router';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as db from '../lib/db';
import { StateProvider } from '../state/store';
import { routeTree } from './router';

async function renderApp() {
  window.location.hash = '#/';
  const router = createRouter({ routeTree, history: createHashHistory() });
  await router.load();
  return render(
    <StateProvider>
      <RouterProvider router={router} />
    </StateProvider>,
  );
}

describe('boot failure', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows a retry screen — not onboarding — when reading settings fails', async () => {
    vi.spyOn(db, 'loadAllSettings').mockRejectedValue(new Error('Connection to Indexed Database server lost'));
    await renderApp();
    expect(await screen.findByRole('heading', { name: /couldn.t open your data/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: "Let's set up Moonflow" })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
  });

  it('retrying re-reads the database and recovers', async () => {
    const spy = vi.spyOn(db, 'loadAllSettings').mockRejectedValueOnce(new Error('transient'));
    await renderApp();
    fireEvent.click(await screen.findByRole('button', { name: /try again/i }));
    expect(await screen.findByRole('heading', { name: "Let's set up Moonflow" })).toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe('root error boundary', () => {
  it('a crashing screen shows a recoverable error screen instead of a blank app', async () => {
    const { createRootRoute, createRoute } = await import('@tanstack/react-router');
    const { AppErrorScreen } = await import('./placeholders');
    const root = createRootRoute({ errorComponent: AppErrorScreen });
    const boom = createRoute({
      getParentRoute: () => root,
      path: '/',
      component: () => {
        throw new Error('boom');
      },
    });
    const router = createRouter({ routeTree: root.addChildren([boom]), history: createHashHistory() });
    window.location.hash = '#/';
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await router.load();
    render(<RouterProvider router={router} />);
    expect(await screen.findByRole('heading', { name: /something went wrong/i })).toBeInTheDocument();
    expect(screen.getByText(/your logs are safe/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
  });

  it('is wired as the real root route\'s error component', async () => {
    const { rootRoute } = await import('./router');
    const { AppErrorScreen } = await import('./placeholders');
    expect(rootRoute.options.errorComponent).toBe(AppErrorScreen);
  });
});
