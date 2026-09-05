import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// base: './' — the live site serves from a GitHub Pages subpath
// (dharanish-v.github.io/moonflow/), not domain root. The default '/' emits
// root-absolute asset paths that 404 there; './' matches this project's
// existing all-relative-path convention and works regardless of subpath.
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        planner: 'planner.html'
      }
    }
  },
  plugins: [
    tailwindcss(),
    VitePWA({
      // Only one service worker is needed — both install identities
      // (index.html/planner.html) already share the same one today.
      // manifest: false — manifest.json/manifest-discreet.json stay
      // hand-maintained static files (see publicDir), each linked directly
      // from its own HTML <head>, since this app installs as two distinct
      // identities from one build (ADR-011) — not a shape vite-plugin-pwa's
      // own manifest generation models.
      manifest: false,
      // generateSW only auto-precaches files Vite's own build graph produces
      // (the hashed JS/CSS + the two HTML entries) — manifest.json/
      // manifest-discreet.json/icons live in publicDir as untouched
      // passthrough files (see ADR-028's monorepo reorg), so Workbox never
      // discovers them on its own. The original hand-written PRECACHE_FILES
      // explicitly included both manifests and all 6 icons — this restores
      // that same full-offline coverage.
      includeAssets: ['manifest.json', 'manifest-discreet.json', 'icons/*.png'],
      registerType: 'autoUpdate',
      // app.js already calls navigator.serviceWorker.register(...) itself —
      // don't let the plugin inject a second registration.
      injectRegister: false,
      filename: 'service-worker.js',
      strategies: 'generateSW',
      workbox: {
        // generateSW defaults navigateFallback to 'index.html' (an SPA
        // assumption) — left on, it would silently serve index.html's head
        // (wrong title/manifest/icons) in place of planner.html on
        // navigation, breaking the discreet-icon feature entirely. This
        // app has no such fallback today (plain precache-or-network), so
        // disable it explicitly to match existing behavior.
        navigateFallback: undefined
      }
    })
  ]
});
