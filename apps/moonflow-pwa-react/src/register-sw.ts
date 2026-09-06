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
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((err: unknown) => {
      console.error('Service worker registration failed:', err);
    });
  });
}
