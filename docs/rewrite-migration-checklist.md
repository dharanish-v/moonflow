# React rewrite — ADR migration checklist

Tracks which of the vanilla app's (`apps/moonflow-pwa/`) 32 ADR-log entries need
re-verification against the React rewrite (`apps/moonflow-pwa-react/`) vs. are
superseded wholesale by the rewrite itself. `adr-log.md` is append-only by its
own stated rule, so this lives as a separate document rather than editing it.

Status as of Phase 7 (full regression pass, before deploy cutover).

## Bucket 1 — superseded wholesale, no re-verification needed

Vanilla-JS/tooling-specific decisions the rewrite deliberately replaces on purpose (see the plan's own Context section).

| ADR | Title | Superseded by |
|---|---|---|
| 004 | No design system/component library/CSS framework | shadcn/ui + Tailwind v4 |
| 005 | Vanilla JavaScript, no UI framework | React 19 |
| 006 | Plain `.js` + JSDoc, not TypeScript | Real TypeScript, strict mode |
| 007 | Hand-rolled state store | Context + `useReducer` (same *philosophy* — flat state, no library — carried forward at a cheaper price; see `src/state/store.tsx`) |
| 008 | BEM naming convention | Tailwind utility classes / CVA variants |
| 010 | Native ESM + import maps, no bundler | Vite + npm |
| 014 | No Node.js dependency (already superseded once, by ADR-029) | Vite/npm/Node required |
| 015 | No animation/gesture library (already partially superseded, by ADR-029's GSAP) | Framer Motion |
| 021 | No minification step | Vite's build minifies + code-splits by default |
| 029 | Vite + Tailwind v4 + GSAP adopted | Vite + Tailwind v4 carry forward; GSAP → Framer Motion |
| 030 | First real Tailwind usage (Home) | Moot — tooling-migration-specific |
| 031 | Every screen migrated to Tailwind | Moot — tooling-migration-specific |
| 032 | daisyUI adopted as component layer | shadcn/ui (Radix primitives) |

## Bucket 2 — behavioral/product truths, re-verified against the rewrite

| ADR | Title | Status |
|---|---|---|
| 001 | Distribute as a PWA, not a native app | ✅ Re-verified Phase 6 — `vite-plugin-pwa` generateSW, real offline reload confirmed on a clean origin |
| 002 | Local-only storage, no backend | ✅ Reconfirmed directly with the user before the rewrite began (Phase 0 planning) — no cloud sync introduced |
| 003 | IndexedDB via Dexie, not raw IndexedDB/localStorage/SQLite | ✅ Unchanged — same `MoonflowDB` name, same `entries`/`settings` schema (`src/lib/db.ts`) |
| 009 | SVG icons only, no emoji | ✅ Ported bespoke icons (`src/components/icons.tsx`) + lucide-react for generic nav icons — both real SVG |
| 011 | Discreet icon is an install-time choice | ✅ Re-verified Phase 6 — `planner.html` second entry, own manifest/icons, offline-tested |
| 012 | Cycle-math dates as date-only values, never timestamps | ✅ Ported verbatim (`src/lib/cycle-math.ts`), same 8 assertions plus new tests, all green |
| 016 | Theming via CSS custom properties + a data-attribute | ⚠️ Partial — CSS custom properties carry forward (`src/index.css`); no data-attribute toggle exists since the app has no light/dark switch (deliberate, unchanged product truth) |
| 017 | Client-side rendered "lean SPA," not islands | ✅ React CSR via Vite, no SSR |
| 018 | Explicit Core Web Vitals target via lab metrics | ✅ Re-verified Phase 7 — production build trace on Home: LCP 120ms, CLS 0.00 |
| 019 | Home shows a literal moon-phase illustration | ✅ Upgraded, not just re-verified — real 3D moon (Phase 5, `MoonPhase3D.tsx`) additive over the 2D fallback (`StaticMoonFallback.tsx`) |
| 020 | `cycle-math.js` needs no date library | ✅ Still true — no date-fns/dayjs/luxon in `package.json` |
| 022 | SW precache force-bypasses HTTP cache | ✅ Unchanged — Workbox `generateSW` default behavior |
| 023 | Deployed to GitHub Pages, repo public | ⏳ **Not yet done for the rewrite** — this is the pending deploy-cutover step, requires explicit user go-ahead before any push |
| 024 | Touch-target 44×44px minimum, two documented exceptions | ✅ Re-verified Phase 7 — live sweep of every interactive element on Home/Calendar/Insights/Settings/Log at true iPhone emulation, zero violations (switch 51×31 and calendar-day 40×40 exceptions intact) |
| 025 | Real device-frame presentation for wide viewports | ✅ Re-verified live at 1440px mouse (framed, correct) |
| 026 | Composed screens vertically center; scannable-list screens stay top-anchored | ✅ Ported faithfully — Home/Onboarding/PinLock/PinSetup center; Calendar/Insights/Settings top-anchor (Insights' populated view centers *within* the space below its fixed heading, matching vanilla exactly) |
| 027 | Device-frame breakpoint tests for a mouse, not just a width | ✅ Re-verified live — 393px touch (edge-to-edge), 480px touch/Android-width (edge-to-edge, correctly *not* framed despite exceeding the 27rem threshold), 1440px mouse (framed) |
| 028 | Repo reorganized into `apps/` + `docs/` | ✅ `apps/moonflow-pwa-react/` follows the same convention |

## Bucket 3 — repro steps

For any of the above needing a deeper repro than this table gives, `task-board.md`'s prose narrative for each original bug is more operationally useful than the ADR log's higher-level framing — check there first.

## New, rewrite-specific findings (not in the vanilla ADR log at all)

Real bugs found and fixed during the rewrite's own live verification, not present in — or not applicable to — the vanilla app:

- **PIN-lock back/forward bypass risk**: `AppGate`'s `isLocked` vs `settings.pinLockEnabled` split (Phase 2), structurally stronger than the vanilla app's imperative popstate bail-out (`<Routes>` isn't mounted at all while locked, vs. a runtime check).
- **jsdom has no `window.matchMedia`**: real browsers always have it; a test-environment gap, not a real-browser bug (Phase 5) — polyfilled in `src/test/setup.ts`.
- **R3F sphere clipped by its own camera frustum**: rendered as a blocky rounded-square blob until the geometry radius was tuned to fit inside the frustum with margin (Phase 5).
- **Native `<progress>` ignored `accent-color`**: rendered its default green instead of the app's accent-blue token in this Chromium build — replaced with a styled div track/fill on Insights (Phase 5).
- **Missing `<main>` landmark**: silently dropped during Phase 4's device-frame refactor (`<div id="app-content">` should have stayed `<main>`), caught by a Lighthouse accessibility pass (Phase 5).
- **`text-muted-foreground/60` contrast failure**: the decorative "பிறை" text on Home measured 2.86:1 against the background — below WCAG AA's 4.5:1 — caught by the same Lighthouse pass (Phase 5).
- **Service worker registration MIME-type error on `npm run dev`**: `service-worker.js` only exists after a real build; registering unconditionally threw on the dev server. Guarded behind `import.meta.env.PROD` (Phase 6/7).
- **Stale service worker from an unrelated earlier preview session shadowed a later build on the same port**: a local-testing-only artifact (same `localhost` port reused across two different apps' preview servers in one long browser session), not a product bug — resolved by testing on a fresh port.

## Verification summary

- `npm test`: 85/85 passing (`npx vitest run`), including jest-axe accessibility checks on every screen and every Phase 3 primitive.
- `tsc -b`: clean.
- `npm run build` + `npm run preview`: both HTML entries (`index.html`, `planner.html`) build correctly, share one JS bundle, `MoonPhase3D` code-splits into its own chunk (~234KB gzipped) that only loads for WebGL2-capable, non-reduced-motion users.
- Full offline reload verified for both entries on a clean origin, zero console errors.
- Lighthouse (snapshot mode, Home): Accessibility 100/100, Best Practices 100/100 (SEO/agentic-browsing scores are low but not applicable — this is a private, local-only, PIN-lockable app with no public content to index).

## Remaining before cutover

- Point production traffic at the new build (ADR-023's re-verification) — **requires explicit user go-ahead**, not to be done automatically.
