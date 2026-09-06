// src/register-sw.ts — registers the Workbox-generated service worker.
// Ported from app.js's own registration call; vite-plugin-pwa's
// injectRegister is off (see vite.config.ts) specifically so this stays the
// one registration, not two.
//
// import.meta.env.PROD guard: dist/service-worker.js only exists after a
// real build — on the Vite dev server the request 404s into the SPA
// fallback and resolves as text/html, which the browser then refuses to
// register as a script (a real, reproducible dev-console error, caught live
// against `npm run dev`). Verified separately via a real `npm run build` +
// `npm run preview` that registration succeeds once the file is real.
export function registerServiceWorker() {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;

  // vite.config.ts's workbox.skipWaiting/clientsClaim get a new build's
  // service worker to take over even while this tab stays open (an
  // installed PWA is rarely fully closed) — but the JS/CSS already loaded
  // into memory doesn't swap itself. This reload-once-on-takeover is the
  // other half: without it, users silently ride an old service worker's
  // cached shell indefinitely, as happened once for real (a stale worker
  // kept serving a build that 404'd on an asset the new build removed).
  let reloadedOnce = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadedOnce) return;
    reloadedOnce = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((err: unknown) => {
      console.error('Service worker registration failed:', err);
    });
  });
}
