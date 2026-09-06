import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// base: './' — this deploys to a GitHub Pages subpath (or a preview path
// during the rewrite), never domain root. Vite's default base:'/' emits
// root-absolute asset paths that 404 under a subpath — ADR-029 already hit
// this exact bug once on the vanilla-JS app's own Vite migration.
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        planner: 'planner.html',
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // manifest: false — manifest.json/manifest-discreet.json stay
      // hand-maintained static files in public/, each linked directly from
      // its own HTML <head>, since this app installs as two distinct
      // identities from one build (ADR-011) — not a shape vite-plugin-pwa's
      // own manifest generation models.
      manifest: false,
      // generateSW only auto-precaches files Vite's own build graph
      // produces (the hashed JS/CSS + the two HTML entries) — the two
      // manifests and all 6 icons live in public/ as untouched passthrough
      // files, so Workbox never discovers them on its own.
      includeAssets: ['manifest.json', 'manifest-discreet.json', 'icons/*.png'],
      registerType: 'autoUpdate',
      // src/register-sw.ts already calls navigator.serviceWorker.register()
      // itself — don't let the plugin inject a second registration.
      injectRegister: false,
      filename: 'service-worker.js',
      strategies: 'generateSW',
      workbox: {
        // generateSW defaults navigateFallback to 'index.html' (an SPA
        // assumption) — left on, it would silently serve index.html's head
        // (wrong title/manifest/icons) in place of planner.html on
        // navigation, breaking the discreet-icon identity entirely. Same
        // reasoning as the vanilla app's own two-entry setup.
        navigateFallback: undefined,
        // registerType: 'autoUpdate' above is a no-op without these:
        // injectRegister:false means the virtual:pwa-register module (the
        // thing that would normally read registerType and act on it) never
        // runs — register-sw.ts's own bare register() call is all there
        // is. Without skipWaiting/clientsClaim, a real installed user who
        // never fully closes every open tab of the app (the common case
        // for a PWA on a home screen) stays on the OLD service worker,
        // and therefore the old cached build, forever — caught live: a
        // real deploy 404'd on an asset the new build no longer ships,
        // and reloading alone never picked up the fix. clientsClaim also
        // needs register-sw.ts's controllerchange listener (see there) to
        // actually get the new code into an already-open tab.
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
