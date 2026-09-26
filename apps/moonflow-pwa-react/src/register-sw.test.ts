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

describe('update on consent (T77)', () => {
  function env({ controlled, waiting = null as unknown }: { controlled: boolean; waiting?: unknown }) {
    const swListeners: Record<string, () => void> = {};
    const regListeners: Record<string, () => void> = {};
    const installing = { state: 'installing', addEventListener: vi.fn((_t: string, fn: () => void) => (installingChange = fn)), postMessage: vi.fn() };
    let installingChange: () => void = () => {};
    const registration = {
      waiting,
      installing: null as unknown,
      addEventListener: (t: string, fn: () => void) => (regListeners[t] = fn),
    };
    const sw = {
      controller: controlled ? {} : null,
      addEventListener: (t: string, fn: () => void) => (swListeners[t] = fn),
      register: vi.fn().mockResolvedValue(registration),
    };
    return { sw, registration, installing, regListeners, swListeners, fireInstalled: () => installingChange() };
  }

  it('announces an update that was already waiting at launch', async () => {
    const waiting = { postMessage: vi.fn() };
    const e = env({ controlled: true, waiting });
    const onUpdateReady = vi.fn();
    registerServiceWorker({ serviceWorker: e.sw, reload: vi.fn(), onLoad: (fn) => fn(), isProd: true, onUpdateReady });
    await vi.waitFor(() => expect(onUpdateReady).toHaveBeenCalled());
    onUpdateReady.mock.calls[0]![0]();
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('announces a new version once it finishes installing — but not the very first install', async () => {
    const e = env({ controlled: true });
    const onUpdateReady = vi.fn();
    registerServiceWorker({ serviceWorker: e.sw, reload: vi.fn(), onLoad: (fn) => fn(), isProd: true, onUpdateReady });
    await vi.waitFor(() => expect(e.regListeners.updatefound).toBeDefined());
    e.registration.installing = e.installing;
    e.regListeners.updatefound!();
    e.installing.state = 'installed';
    e.fireInstalled();
    expect(onUpdateReady).toHaveBeenCalled();

    const first = env({ controlled: false });
    const onFirst = vi.fn();
    registerServiceWorker({ serviceWorker: first.sw, reload: vi.fn(), onLoad: (fn) => fn(), isProd: true, onUpdateReady: onFirst });
    await vi.waitFor(() => expect(first.regListeners.updatefound).toBeDefined());
    first.registration.installing = first.installing;
    first.regListeners.updatefound!();
    first.installing.state = 'installed';
    first.fireInstalled();
    expect(onFirst).not.toHaveBeenCalled();
  });
});

