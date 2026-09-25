import { describe, expect, it, vi } from 'vitest';
import { registerServiceWorker } from './register-sw';

function fakeEnv({ controlled }: { controlled: boolean }) {
  const listeners: Record<string, () => void> = {};
  const sw = {
    controller: controlled ? {} : null,
    addEventListener: (type: string, fn: () => void) => (listeners[type] = fn),
    register: vi.fn().mockResolvedValue({}),
  };
  const reload = vi.fn();
  const persist = vi.fn().mockResolvedValue(true);
  return { sw, reload, persist, fire: (t: string) => listeners[t]?.() };
}

describe('registerServiceWorker', () => {
  it('does not reload on the very first install (nothing was controlling the page)', () => {
    const env = fakeEnv({ controlled: false });
    registerServiceWorker({ serviceWorker: env.sw, reload: env.reload, persist: env.persist, onLoad: (fn) => fn(), isProd: true });
    env.fire('controllerchange');
    expect(env.reload).not.toHaveBeenCalled();
  });

  it('reloads exactly once when a new version takes over an already-controlled page', () => {
    const env = fakeEnv({ controlled: true });
    registerServiceWorker({ serviceWorker: env.sw, reload: env.reload, persist: env.persist, onLoad: (fn) => fn(), isProd: true });
    env.fire('controllerchange');
    env.fire('controllerchange');
    expect(env.reload).toHaveBeenCalledTimes(1);
  });

  it('asks the browser to make storage persistent', () => {
    const env = fakeEnv({ controlled: false });
    registerServiceWorker({ serviceWorker: env.sw, reload: env.reload, persist: env.persist, onLoad: (fn) => fn(), isProd: true });
    expect(env.persist).toHaveBeenCalled();
  });

  it('does nothing outside a production build', () => {
    const env = fakeEnv({ controlled: false });
    registerServiceWorker({ serviceWorker: env.sw, reload: env.reload, persist: env.persist, onLoad: (fn) => fn(), isProd: false });
    expect(env.sw.register).not.toHaveBeenCalled();
  });
});
