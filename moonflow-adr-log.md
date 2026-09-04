# Moonflow — Architecture Decision Record (ADR) Log

Unlike `moonflow-design-system.md` (the current spec — *what* we're building), this is a chronological, append-only log of *why* each major decision was made. Once accepted, an entry is not edited in place. If a decision changes later, a new ADR supersedes it, and both stay in the log.

---

### ADR-001: Distribute as a PWA, not a native app
**Status:** Accepted
**Context:** Needed to install on iPhone without an Apple Developer account, App Store review, or expiring provisioning profiles, and be shareable via a plain WhatsApp/Telegram link.
**Decision:** Build as a Progressive Web App, installed via Safari's "Add to Home Screen."
**Consequences:** No Face ID API, no background sync, no App Store distribution. In exchange: zero account cost, no review process, instant updates by redeploying files. The recipient must open the link in actual Safari — WhatsApp/Telegram's in-app browser can't install PWAs.

### ADR-002: Local-only storage, no backend
**Status:** Accepted
**Context:** This is single-user, single-device health data. A synced multi-device architecture (CRDTs, a relay server) is real engineering complexity that only pays off if a second device is genuinely needed.
**Decision:** All data lives in IndexedDB on-device only. No account, no server, no sync.
**Consequences:** Maximally private — nothing leaves the device, ever. Standard iPhone backups cover device loss; JSON export is the manual bridge to a new phone. A synced second device is not supported without future rework (though the clean data model doesn't block adding it later).

### ADR-003: IndexedDB via Dexie, not raw IndexedDB, localStorage, or SQLite/OPFS
**Status:** Accepted
**Context:** localStorage is synchronous, string-only, and capped around 5–10MB — too limited for growing structured records. SQLite-via-OPFS gives real SQL but requires a WASM binary and worker-thread setup, real complexity for a dataset of a few hundred records a year. Raw IndexedDB's native callback API is a well-documented source of silent schema-versioning data-loss bugs.
**Decision:** IndexedDB as the storage engine, wrapped in Dexie.js for queries, transactions, and schema migrations.
**Consequences:** Same native engine, far safer API. One small dependency (~27KB) instead of hand-rolling error-prone raw IndexedDB code.

### ADR-004: No design system, component library, or CSS framework
**Status:** Accepted
**Context:** Moonflow's visual language (night-sky palette, moon ring, custom accent-color mapping) is fully bespoke. Material Design, Bootstrap, Chakra, shadcn/ui, and Tailwind all bring their own visual opinions or token systems that would need overriding to match it.
**Decision:** Hand-rolled CSS using our own custom properties as the single token source. No Tailwind, even as a build-free CDN option (its production path still requires a compile step we're avoiding everywhere else).
**Consequences:** Full 1:1 fidelity to the mockups, zero fighting a framework's defaults, zero extra build tooling. Costs slightly more manual CSS-writing than utility classes would — acceptable at ~10 component types.

### ADR-005: Vanilla JavaScript, no UI framework
**Status:** Accepted
**Context:** React/Vue/Svelte solve problems (deep component trees, complex prop-drilling, large team coordination) that don't exist at 5 screens and ~10 components for a solo project.
**Decision:** Plain JavaScript, native ES Modules for code organization, no framework runtime.
**Consequences:** No 40–100KB+ framework runtime sitting in memory. No build step. Reactivity and screen-rendering are hand-rolled (see ADR-007) instead of provided for free.

### ADR-006: Plain `.js` with JSDoc type-checking, not TypeScript
**Status:** Accepted
**Context:** TypeScript needs a compile step to run in a browser at all, conflicting with the zero-build-step goal. But cycle-math and IndexedDB code are exactly where a silent type mistake (e.g., conflating a `Date` and a timestamp) causes real bugs.
**Decision:** Plain `.js` files with `// @ts-check` and JSDoc annotations — editor-level type-checking with no compiler and no build output.
**Consequences:** Most of TypeScript's safety for the riskiest code, zero tooling cost. The file you write is exactly the file that ships.

### ADR-007: Hand-rolled state store, not Redux/Zustand/Signals
**Status:** Accepted
**Context:** Considered `@preact/signals-core` for fine-grained, auto-tracked reactivity. At Moonflow's scale (a handful of state fields, 5 screens), the auto-dependency-tracking signals provide isn't solving a real problem we have.
**Decision:** A ~20-line hand-rolled state object + subscribe pattern. Full HTML re-render on screen navigation; targeted class toggles for in-screen interactions, to avoid disrupting input focus (e.g., the notes field).
**Consequences:** Zero dependencies for state management. Coarser than fine-grained signals — every subscriber fires on every change — but that's a non-issue at this scale, and it's a decision made on purpose, not by default.

### ADR-008: BEM naming convention
**Status:** Accepted
**Context:** Plain CSS with no methodology risks style collisions and unclear component ownership, even in small codebases, and hurts readability for a solo maintainer returning to the project after months away.
**Decision:** `.block__element--modifier` naming for all custom CSS, applied practically rather than to strict orthodoxy.
**Consequences:** Self-documenting component boundaries at zero tooling cost — it's a naming convention, not a library.

### ADR-009: SVG icons only (Tabler), no emoji anywhere
**Status:** Accepted
**Context:** Considered emoji for the mood picker specifically, since the sad-to-happy emoji scale is a widely recognized convention. Rejected because emoji rendering is owned by Apple and can shift with any iOS update (undermining the whole point of a frozen design), can't be recolored to match the accent palette, and has known cross-browser vertical-alignment quirks.
**Decision:** Tabler Icons (SVG), inlined for only the ~17 icons actually used — never the full icon font, and never emoji, including in the mood picker.
**Consequences:** Full visual control, permanent regardless of OS updates, minimal footprint (~1–2KB vs. 100–300KB for a full icon font).

### ADR-010: Native ES Modules + import maps, self-hosted dependencies, no bundler
**Status:** Accepted
**Context:** Needed a way to split code into files and cleanly reference two small third-party libraries (Dexie, date-fns) without introducing a bundler.
**Decision:** `<script type="module">` with relative-path imports for first-party code; an import map for clean bare-specifier names on the two dependencies, which are downloaded once and self-hosted rather than loaded from a live CDN.
**Consequences:** Zero build step, and self-hosting means the offline-first PWA never depends on a third-party CDN being reachable to boot.

### ADR-011: Discreet icon is an install-time choice, not a live in-app toggle
**Status:** Accepted (supersedes the original Settings-toggle design)
**Context:** Originally designed as a Settings toggle. Discovered a real platform constraint: a PWA's home-screen icon is fixed at the moment "Add to Home Screen" is tapped and cannot be live-swapped afterward by anything running inside the app — unlike a native app's Alternate Icons API.
**Decision:** Publish two separate install links (real icon + discreet "Planner" icon). Switching requires removing the home-screen icon and reinstalling from the other link.
**Consequences:** The feature still works, but as an install-time decision rather than an in-app setting — moved from the V2 list into V1 once this was designed properly.

### ADR-012: All cycle-math dates stored as date-only values, never timestamps
**Status:** Accepted
**Context:** Timezone and DST transitions are a classic source of silent off-by-one-day bugs in date arithmetic — especially relevant for a person who travels across timezones.
**Decision:** Store every logged date as a plain date-only value (`"2026-09-04"`, no time component) and perform all interval math on date-only values via date-fns.
**Consequences:** Sidesteps the entire class of timezone/DST bugs rather than attempting to handle them — there's no time-of-day left to get confused about.

### ADR-013: No local AI model
**Status:** Accepted
**Context:** Considered running a small on-device model (Transformers.js / WebGPU, both feasible on iOS 26 Safari) for smarter insights or a "chat with your data" feature.
**Decision:** No local model. The logged dataset (a few hundred entries a year) is too small for ML to outperform the median/statistics approach already in use; a "chat with your data" feature would route deterministic questions (e.g., "when was my last period") through a model that could hallucinate a wrong date, which is a strict downgrade for health data over an exact database query. Even a small model's footprint (tens of MB to low GB) is orders of magnitude past the app's target footprint (under 150KB).
**Consequences:** No AI dependency, no risk of a hallucinated answer about someone's own health data. Any "feels smart" copy is achieved with plain conditional templates instead (e.g., a rule comparing recent cycle-length variance to a threshold), at effectively zero resource cost.
**Note:** feasibility was revisited once a much larger app-size budget was put on the table — LiteRT.js, WebLLM, and ONNX Runtime Web are all genuinely viable on iOS 26 Safari. Status here remains accepted for V1; a future entry should supersede this one only once a specific model/approach is actually committed to, not while still exploring.

### ADR-014: No Node.js dependency, including at dev-time
**Status:** Accepted (corrects an inconsistency introduced in the initial README and test file)
**Context:** The README's local-dev instructions used `npx serve .`, and the first cycle-math test file used Node's built-in `node:test`/`node:assert`. Neither ships to the phone, but both quietly required Node/npm to be installed on the dev machine — inconsistent with how deliberately every other dependency in this stack has been scrutinized.
**Decision:** Local dev serving uses `python3 -m http.server` (pre-installed on macOS/Linux, no additional install). Tests run as a plain HTML page opened directly in a browser, with assertions and pass/fail output rendered to the page — no test runner, no Node.
**Consequences:** The project requires literally nothing beyond a browser and a way to serve static files, for both running the app and testing it. Trade-off: browser-based tests are slightly less convenient to run from a terminal/CI than `node --test` would be — acceptable, since there's no CI here and no team to standardize tooling for.

### ADR-015: No animation library (Lottie, GSAP, etc.) or gesture library
**Status:** Accepted
**Context:** Wanted genuinely smooth, "buttery" animations and better gestures. React Native Skia doesn't apply — it's a native React Native rendering library, unusable in a web/Safari context. Lottie's web player is real and usable here, but its player alone is ~60–100KB (a large share of the app's ~150KB budget), and its SVG/Canvas rendering runs on the main JS thread, which can jank under load — the opposite of the goal.
**Decision:** All animation uses native CSS transitions/`@keyframes` and the Web Animations API, restricted to compositor-friendly properties (`transform`, `opacity`) wherever possible. Gestures use native CSS `scroll-snap` for the calendar month swipe, and the native Pointer Events API (hand-written, ~40 lines) for the log-sheet swipe-to-dismiss — no gesture library.
**Consequences:** Zero added bytes, and compositor-thread animations that stay smooth even while the main thread is busy (e.g. mid IndexedDB write) — a stronger performance guarantee than a JS animation library gives, not just a lighter one. Trade-off: no support for pre-authored complex vector illustrations (an After Effects export) — not a real cost, since nothing in Moonflow's design calls for that level of animation complexity.

### ADR-016: Theming via CSS custom properties + a data-attribute, not separate stylesheets
**Status:** Accepted
**Context:** V2 plans a light theme. Needed to confirm this can be added later without reworking already-built CSS or component markup.
**Decision:** Every color in `components.css`/`screens.css` references a token from `tokens.css` — never a hardcoded hex value. A theme is a second block of the same variable names scoped to `[data-theme="light"]`, switched at runtime with one line (`document.documentElement.dataset.theme = 'light'`).
**Consequences:** Adding a theme later touches only `tokens.css` — zero changes to markup, component CSS, or JS. Requires strict discipline from the first line of CSS onward: a single hardcoded hex value slipped into a screen file silently breaks re-theming for that one element. The glass tab bar's fill is the one token whose *value* needs real design work for a light theme, not a mechanical inversion — the structure carries over, the number doesn't.

### ADR-017: Client-side rendered "lean SPA," not islands architecture
**Status:** Accepted
**Context:** Asked directly whether Moonflow avoids the heavy-SPA "ship JS, then build the page" pattern via islands architecture instead.
**Decision:** Moonflow is structurally SPA-shaped — `index.html` ships a near-empty shell, and `app.js` renders screen content into it after reading IndexedDB. This is not islands architecture, and can't be: islands requires a build/pre-render step, which conflicts with the no-build decision (ADR-005), and its core value — separating static content from interactive widgets — doesn't apply here regardless, since nearly everything Moonflow shows is personalized to the user's own local data and can't be known at build time. The one static, non-personalized piece — the tab bar — is written as real HTML directly in `index.html` rather than JS-generated, so something paints before any JS executes.
**Consequences:** Honestly SPA-shaped rather than islands-shaped, but at a fraction of a typical SPA's weight — no framework runtime, no virtual DOM, ~150KB total, per-screen code-splitting. Combined with the service worker cache and zero-network local reads, the practical JS-to-first-paint delay is milliseconds, not the hydration pause islands architecture exists to avoid.

### ADR-018: Explicit Core Web Vitals target, via lab metrics rather than field data
**Status:** Accepted
**Context:** Wanted a "100% Web Vitals" app. Real Core Web Vitals are normally reported from real-user field data via the Chrome UX Report — a pipeline that only exists for public, high-traffic sites and will never apply to a private single-user PWA. What's actually achievable and meaningful is the lab-measured equivalent: a 100/100 Lighthouse score with LCP, INP, and CLS each independently in the "Good" range, checked locally.
**Decision:** One concrete technique per metric — (1) **LCP**: the initial HTML ships a static skeleton of the main visual (extending ADR-017's static shell beyond just the tab bar), so something paints before the JS-boot chain completes, with real data swapping in immediately after; (2) **INP**: all UI feedback is optimistic — "Saved" renders immediately on tap, the IndexedDB write happens asynchronously underneath, never blocking the visual response; (3) **CLS**: every SVG specifies explicit width/height, and the content container reserves identical space in both its skeleton and final-render states, so nothing shifts when real content replaces the placeholder.
**Consequences:** A genuinely fast, stable, responsive app, verifiable locally via Chrome DevTools' Lighthouse panel or PageSpeed Insights (not the npm Lighthouse CLI, consistent with ADR-014's no-Node stance) — but the field-data "Core Web Vitals report" sense of the term simply doesn't apply to a private PWA with no CrUX telemetry, worth naming rather than implying a badge that could never exist here.

### ADR-019: Home screen shows a literal moon-phase illustration, not an abstract ring, with a Tamil signature detail
**Status:** Accepted (supersedes the original ring-based home screen concept)
**Context:** Wanted the design to feel distinctive rather than reading as a generic "premium wellness app" template — a gold progress ring is a very common pattern since Apple Fitness, and dark-navy-plus-gold is becoming its own cliché in the wellness-app space. A Tamil-signature idea was proposed alongside it; confirmed as genuinely personally meaningful, not a decorative flourish added for its own sake.
**Decision:** The home screen's central visual is the actual current lunar phase, rendered via an offset-circle technique with a dot-grain texture rather than a flat vector fill — literal and tied to the app's name, not an abstraction. A small Tamil word, பிறை ("crescent"), sits below it as a quiet personal signature.
**Consequences:** One new token, `--moon-unlit` (`#2A2850`), for the illustration's dark portion. This genuinely supersedes the originally frozen ring concept — the earlier home screen mockup is no longer the target design. No other screen is affected; calendar, log-entry, insights, and settings keep their original specs.

### ADR-020: cycle-math.js needs no date library — date-fns removed
**Status:** Accepted (corrects earlier planning docs, discovered during T5 implementation)
**Context:** Earlier turns planned to pull in date-fns specifically to avoid DST-transition bugs in date arithmetic. Once ADR-012 committed to date-only values (no time component) everywhere, the actual risk surface shrank to one specific thing: whether subtracting two local-midnight `Date` objects and dividing by milliseconds-per-day gives the correct whole-day count across a DST transition.
**Decision:** No date-fns. `cycle-math.js` uses two small local functions — `parseDate` (constructs a `Date` at local midnight from a `"YYYY-MM-DD"` string) and `diffDays` (subtracts two such dates and rounds the result). A single DST transition only ever contributes a ±1 hour offset (≤1/24 of a day) to the raw millisecond difference — `Math.round()` always recovers the correct integer day count regardless, no matter how many transitions occurred in between. Verified against all 8 existing test cases before this decision was finalized.
**Consequences:** One fewer dependency than planned, ~0 added bytes for date math instead of even a tree-shaken date-fns import. This is a genuine simplification earned by an earlier decision (ADR-012), not a shortcut — the risk date-fns would have protected against was already mostly eliminated before cycle-math.js was ever written.

### ADR-021: No minification step for our own code; rely on host-level gzip
**Status:** Accepted
**Context:** Measured our own hand-written files after T1–T5: 12,281 bytes raw, 4,643 bytes gzipped combined — a 62% reduction from gzip alone, with zero minification. Minification's main win (stripping whitespace/comments) largely overlaps with what gzip already captures, since that content is exactly what compresses best; the incremental savings on top of gzip are small relative to the app's total footprint, which is dominated by vendored Dexie (~29.5KB gzipped) rather than our own code.
**Decision:** No minification step. Every static host under consideration (Vercel, Netlify, Cloudflare Pages, GitHub Pages) automatically gzip/brotli-compresses text assets with zero configuration — that's the real win, already accounted for. A genuinely Node-free minifier does exist if this is ever revisited (esbuild ships a standalone native binary, not a Node package), but wasn't adopted because the source file and the shipped file would then differ, meaning local testing would never exercise the exact bytes that ship.
**Consequences:** What's edited is exactly what's tested and exactly what ships — no minification-introduced bug can exist, because nothing is introduced. Tree-shaking (a related but distinct concept — removing unused code from a bundle) is satisfied architecturally rather than by tooling: per-screen dynamic `import()` and hand-picked inlined icons mean unused code is never included in the first place, rather than included and later stripped.

### ADR-022: Service worker precache fetches force-bypass the browser's HTTP cache
**Status:** Accepted
**Context:** Discovered during T22/T23 dev testing: bumping `CACHE_VERSION` correctly invalidates the service worker's own Cache Storage entry and triggers a real reinstall, but `cache.addAll(PRECACHE_FILES)`'s internal `fetch()` calls still go through the *browser's own HTTP cache* first. `python3 -m http.server` (this project's dev server, per ADR-014) sends no `Cache-Control` header, so Chrome applies RFC 7234 heuristic freshness and can serve an already-stale response to `addAll` with no revalidation at all — silently re-caching old bytes into the brand-new cache version. This reproduced concretely: editing `components.css` and bumping `CACHE_VERSION` still served the pre-edit stylesheet after a full reinstall, until the fetch itself was forced to bypass HTTP cache.
**Decision:** Every precache request is wrapped as `new Request(url, { cache: 'reload' })` before being passed to `cache.addAll()`, forcing a real network round-trip for each file on every install, independent of whatever the browser's HTTP cache believes about freshness.
**Consequences:** `CACHE_VERSION` bumps are now reliably honored — a version bump always means the new cache actually contains the current file contents, not whatever the browser's HTTP cache happened to be holding. This is dev-server-specific in *how* it was discovered (a host with weak/no cache headers on non-hashed paths, which describes several of the static hosts this project targets too, not just local dev), but the fix is unconditionally correct and free in production regardless of host cache-header behavior.

### ADR-023: Deployed to GitHub Pages; repo made public to allow it
**Status:** Accepted
**Context:** T25 needed a concrete static host (the tech stack doc always listed Vercel/Netlify/GitHub Pages/Cloudflare Pages as equally viable). GitHub Pages was the natural first choice since the code already lives on GitHub — but the GitHub API confirmed Pages is unavailable for private repositories on the free plan outright (not merely "the served site is public even from a private repo," which was the initially assumed, milder constraint).
**Decision:** Made the `dharanish-v/moonflow` repository public, then enabled Pages with `build_type: workflow`. `.github/workflows/deploy-pages.yml` uploads `moonflow-app/` (not the repo root, since the app lives in a subfolder alongside the planning docs) as the Pages artifact on every push to `main`.
**Consequences:** The source code is now publicly visible on GitHub. This was a deliberate, explicit tradeoff (not a default) — no user data was ever affected either way: entries live only in each install's own on-device IndexedDB, never in the repo or the deployed static site, regardless of repo visibility. The deployed site's own HTML/JS was always going to be inspectable by any visitor anyway (true of any client-side PWA on any host), so public source on GitHub adds no new exposure beyond what deploying at all already implied. If this is ever revisited (e.g. moving to Vercel/Netlify/Cloudflare Pages, all of which support private-repo deploys on their free tiers without a plan-level block), the repo can be made private again independent of the app's own privacy properties.
