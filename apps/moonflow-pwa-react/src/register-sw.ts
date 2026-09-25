// src/register-sw.ts — registers the Workbox-generated service worker and
// asks for persistent storage. vite-plugin-pwa's injectRegister is off (see
// vite.config.ts) so this stays the one registration, not two.
//
// Dependencies are injectable so the reload rules are unit-testable.

interface SwContainer {
  controller: unknown;
  addEventListener: (type: 'controllerchange', fn: () => void) => void;
  register: (url: string) => Promise<unknown>;
}

interface RegisterDeps {
  serviceWorker?: SwContainer;
  reload: () => void;
  persist?: () => Promise<boolean>;
  onLoad: (fn: () => void) => void;
  isProd: boolean;
}

function browserDeps(): RegisterDeps {
  return {
    serviceWorker: 'serviceWorker' in navigator ? (navigator.serviceWorker as unknown as SwContainer) : undefined,
    reload: () => window.location.reload(),
    persist: navigator.storage?.persist?.bind(navigator.storage),
    onLoad: (fn) => window.addEventListener('load', fn),
    // dist/service-worker.js only exists after a real build — on the dev
    // server the request 404s into the SPA fallback as text/html.
    isProd: import.meta.env.PROD,
  };
}

export function registerServiceWorker(deps: RegisterDeps = browserDeps()) {
  if (!deps.isProd) return;

  // Home-screen web apps are already exempt from Safari's 7-day storage cap;
  // persist() additionally exempts this origin from eviction under storage
  // pressure. No prompt on iOS — granted by heuristic.
  void deps.persist?.().catch(() => false);

  const sw = deps.serviceWorker;
  if (!sw) return;

  // skipWaiting/clientsClaim (vite.config.ts) let a new build take over an
  // open tab, but the JS already in memory doesn't swap itself — hence one
  // reload on takeover. Only when a worker was *already* controlling the
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

  deps.onLoad(() => {
    sw.register('./service-worker.js').catch((err: unknown) => {
      console.error('Service worker registration failed:', err);
    });
  });
}
