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
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
