// src/register-sw.ts — registers the Workbox-generated service worker and
// asks for persistent storage. vite-plugin-pwa's injectRegister is off (see
// vite.config.ts) so this stays the one registration, not two.
//
// Dependencies are injectable so the reload rules are unit-testable.

interface Worker {
  state?: string;
  postMessage: (msg: unknown) => void;
  addEventListener?: (type: 'statechange', fn: () => void) => void;
}

interface Registration {
  waiting: Worker | null | unknown;
  installing: Worker | null | unknown;
  addEventListener: (type: 'updatefound', fn: () => void) => void;
}

interface SwContainer {
  controller: unknown;
  addEventListener: (type: 'controllerchange', fn: () => void) => void;
  register: (url: string) => Promise<unknown>;
}

/** Called when a new version has installed and is waiting; invoke the
 * argument to activate it (the page then reloads onto it). */
export type UpdateReadyHandler = (applyUpdate: () => void) => void;

interface RegisterDeps {
  serviceWorker?: SwContainer;
  reload: () => void;
  persist?: () => Promise<boolean>;
  onLoad: (fn: () => void) => void;
  isProd: boolean;
  onUpdateReady?: UpdateReadyHandler;
}

function browserDeps(onUpdateReady?: UpdateReadyHandler): RegisterDeps {
  return {
    onUpdateReady,
    serviceWorker: 'serviceWorker' in navigator ? (navigator.serviceWorker as unknown as SwContainer) : undefined,
    reload: () => window.location.reload(),
    persist: navigator.storage?.persist?.bind(navigator.storage),
    onLoad: (fn) => window.addEventListener('load', fn),
    // dist/service-worker.js only exists after a real build — on the dev
    // server the request 404s into the SPA fallback as text/html.
    isProd: import.meta.env.PROD,
  };
}

export function registerServiceWorker(deps: RegisterDeps | UpdateReadyHandler = browserDeps()) {
  if (typeof deps === 'function') deps = browserDeps(deps);
  if (!deps.isProd) return;

  // Home-screen web apps are already exempt from Safari's 7-day storage cap;
  // persist() additionally exempts this origin from eviction under storage
  // pressure. No prompt on iOS — granted by heuristic.
  void deps.persist?.().catch(() => false);

  const sw = deps.serviceWorker;
  if (!sw) return;

  // Once a new worker takes over (after the user taps Update), the JS
  // already in memory doesn't swap itself — hence one reload on takeover. Only when a worker was *already* controlling the
  // page, though: with clientsClaim the very first install also fires
  // controllerchange, and reloading then threw away a new user's half-filled
  // onboarding (and cost a 2.4s double load).
  const wasControlled = !!sw.controller;
  let reloadedOnce = false;
  sw.addEventListener('controllerchange', () => {
    if (!wasControlled || reloadedOnce) return;
    reloadedOnce = true;
    deps.reload();
  });

  // Update on consent (T77): the build no longer skips waiting, so a new
  // version installs quietly and waits. We tell the app; the user taps
  // Update, which messages the waiting worker to take over (Workbox's
  // generated worker listens for SKIP_WAITING), then controllerchange above
  // reloads. Untouched, it activates the next time the app is fully closed.
  const announce = (worker: Worker) => deps.onUpdateReady?.(() => worker.postMessage({ type: 'SKIP_WAITING' }));

  deps.onLoad(() => {
    sw.register('./service-worker.js')
      .then((reg) => {
        const registration = reg as Registration;
        if (registration.waiting && wasControlled) announce(registration.waiting as Worker);
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing as Worker | null;
          installing?.addEventListener?.('statechange', () => {
            // 'installed' with an existing controller = an update, not the first install.
            if (installing.state === 'installed' && wasControlled) announce(installing);
          });
        });
      })
      .catch((err: unknown) => {
        console.error('Service worker registration failed:', err);
      });
  });
}
