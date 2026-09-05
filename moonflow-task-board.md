# Moonflow — Task Board

Ordered by dependency, not just priority — each phase assumes the previous one is done. Every ticket references the doc that specifies it, so "what exactly does this mean" always has an answer.

## Phase 0 — Foundation ✅ done
*Nothing user-facing yet; this is the ground everything else stands on.*

**T1 — Project file structure** (S) ✅
**T2 — Design tokens (`tokens.css`)** (S) ✅
**T3 — `db.js` (Dexie schema)** (S) ✅
**T4 — `constants.js`** (S) ✅
**T5 — `cycle-math.js`** (M) ✅ — 8/8 tests passing; date-fns removed as unnecessary (ADR-020)

## Phase 1 — Screens
*Each screen is a render function; build in this order since later ones assume earlier ones exist.*

## Phase 1 — Screens ✅ done
*Each screen is a render function; build in this order since later ones assume earlier ones exist.*

**T6 — Onboarding screen** (M) ✅ — plus `components.css` (button/field/stepper) and `icons.js` (moon icon), built as needed; 8/8 interaction tests passing
**T7 — Home screen** (M) ✅ — moon-phase illustration (real astronomical approximation, `moon-phase.js`), quick actions; 8/8 tests
**T8 — Log-entry screen** (M) ✅ — shared today/edit mode, upsert-safe; 12/12 tests
**T9 — Calendar screen** (M) ✅ — 11/11 tests; caught and fixed a real bug (future-date logic was inverted, disabling past dates instead of future ones)
**T10 — Insights screen** (S) ✅ — 8/8 tests, including the empty state
**T11 — Settings screen** (S) ✅ — 9/9 tests

**Refactor during T7–T11:** each screen initially rendered its own tab bar, contradicting ADR-017 (tab bar must be static shell HTML, never JS-rendered). Caught and fixed before `app.js` was built on top of the inconsistent pattern — the tab bar was pulled out of all 4 screens.

Depends on: T2, T3, T4, T5

## Phase 2 — App shell ✅ done
**T12 — `store.js`** (S) ✅
**T13 — `app.js`** (M) ✅ — 11/11 full end-to-end integration tests (real, faked IndexedDB): fresh install → onboarding → home → log entry → save → calendar edit → close → insights → settings → toggle
**T14 — Static tab-bar shell in `index.html`** (S) ✅ — plus `planner.html` (discreet variant, ADR-011)
**T15 — LCP skeleton for the home visual** (S) ✅ — built into `index.html` alongside T14

Depends on: T6–T11

## Phase 3 — PWA plumbing ✅ done
**T16 — Icons** (M) ✅ — real PNGs generated and visually verified at 180/192/512px, both variants
**T17 — `manifest.json` + `manifest-discreet.json`** (S) ✅
**T18 — `service-worker.js`** (M) ✅ — versioned cache, precache list cross-checked byte-for-byte against the actual file tree; registration added to `app.js`

Depends on: T13

**Known, deliberate gaps in this pass** (not bugs — just not yet built): the cycle-length/period-length rows in Settings are tap targets without an editing UI yet; the Reminders toggle is intentionally disabled (V2).

## Phase 4 — Security & data safety ✅ done
**T19 — PIN lock** (M) ✅ — `pin-auth.js` (SHA-256 hash via Web Crypto + a pure `evaluatePinAttempt` lockout decision, unit-tested in `tests/pin-auth-tests.html`, 8/8), `screens/pin-lock.js` (native numeric input, enter-twice create flow). Enforced at boot and re-enforced via Page Visibility after the `PIN_RELOCK_AFTER_MINUTES` timeout; lockout state persists in the settings table so it survives a reload. Verified live: create → mismatch → confirm, hash-not-plaintext in IndexedDB, 5-wrong-attempts lockout, correct PIN still rejected mid-lockout, recovery once the lockout window passes.
**T20 — Draft autosave** (S) ✅ — pure `resolveInitialDraft` in `log-entry.js` decides draft-vs-saved-entry precedence (unit-tested, 5/5, including the stale-draft-wrong-date edge case); app.js persists the latest in-progress snapshot on `visibilitychange` (hidden), clears it on Save/Clear/Close. Verified live: fill a field, background the tab, reload (cold boot), unlock, reopen the same day's log — draft restored exactly; confirmed cleared from IndexedDB after Save.
**T21 — Export via Share Sheet** (S) ✅ — payload-building pulled into pure `export.js` (`buildExportPayload`/`exportFilename`, unit-tested 3/3); app.js's `exportData()` tries `navigator.share()` first, falls back to a plain download. Verified live: valid, complete JSON produced via the fallback path (this dev machine's Chrome doesn't support file-sharing through the Web Share API — the real Share Sheet still needs the on-iPhone QA pass per the checklist).

Depends on: T8, T11

## Phase 5 — Polish
**T22 — Animations & gestures** (M) ⏳ mostly done — button press states already existed pre-Phase-5 (`:active{transform:scale()}` throughout components.css). Added: generic `.screen-enter` fade/slide-up transition on every navigation (`app.js`, reduced-motion-safe); the moon-phase illustration's one-time fade-and-scale-in via `getMoonPhaseAnimationClass()` in `home.js` (animates on first render only, never on re-render — 7/7 tests in `tests/animation-tests.html`); the log-entry sheet now gets its designed glass treatment (`.log-sheet`, same tokens as the tab bar), slides up on open, and supports real swipe-down-to-dismiss via native Pointer Events (`gestures.js`'s pure `shouldDismissSheet()` threshold, verified both by unit test and by dispatching synthetic PointerEvents against the live app). **Deferred:** calendar month-swipe via CSS `scroll-snap-type: x` (ADR-015's specified technique) — would require rendering 3 adjacent months for a true scroll-snap container, a bigger structural change to an already-solid, tested screen; Prev/Next buttons fully cover the same functionality today. Left as an explicit, scoped remainder rather than rushed.
**T23 — Accessibility pass** (M) ⏳ in progress — fixed via `tests/accessibility-tests.html` (11/11): Export-data button had zero accessible name (icon-only, aria-hidden SVG, no label); Discreet-icon/cycle-length/period-length settings rows were inert `<div>`s with only a click listener, unreachable by VoiceOver swipe; flow pills/symptom chips/mood buttons exposed no `aria-pressed` selection state; calendar day cells had no spoken state beyond the bare number (now "September 4, period day, today" per the design-doc edge-case rule). Remaining: `rem` sizing and safe-area insets already verified in place from Phase 2/3; full on-device VoiceOver swipe-order and grayscale-screenshot checks are manual, left for T26.
**T24 — Web Vitals pass** (S) ✅ done — 5/5 tests in `tests/web-vitals-tests.html`. Found and fixed: no SVG anywhere (17 inlined icons, the moon-phase illustration, the 4 static tab-bar icons in `index.html`/`planner.html`) had explicit `width`/`height`, only `viewBox` — a direct, unmet ADR-018 requirement, now fixed everywhere. Found and fixed a real latent bug along the way: Save gave zero visual feedback until the async write resolved, and a *failed* save left the button permanently disabled with no error shown at all — a genuine silent-loss case the data-safety rules explicitly forbid. Now the button shows "Saved" synchronously on tap (confirmed live: still "Saved" and disabled immediately after `.click()`, before the write's promise had a chance to resolve), and a failed write re-enables the button and shows the copy-deck's "Couldn't save — try again" inline.

**Bugs found + fixed along the way (Phase 5):**
- `service-worker.js`'s `CACHE_VERSION` was never bumped after Phase 4, so its cache-first strategy was silently serving pre-Phase-4 `app.js`/`settings.js`/`calendar.js`/`log-entry.js`, and `pin-auth.js`/`export.js`/`screens/pin-lock.js` were never added to `PRECACHE_FILES` at all — meaning PIN lock and export would have failed outright in airplane mode (breaks the "fully works with airplane mode on" QA item, for a security feature no less). Fixed, verified live fully offline.
- Deeper cause of the same class of bug (see ADR-022): `cache.addAll()`'s own fetches were still subject to the *browser's* HTTP cache, so a `CACHE_VERSION` bump alone didn't guarantee fresh bytes — reproduced concretely while testing T22 (a CSS edit + version bump still served stale styles). Fixed with `{cache: 'reload'}` on every precache request.
- A failed log entry save permanently disabled the Save button with no error message — a real, pre-existing silent-data-loss bug, fixed as part of T24 (see above).
- **Reminder for future work:** every new file added to `PRECACHE_FILES` and every `CACHE_VERSION` bump must happen together, every time a cached file changes — easy to forget mid-feature-work, as this phase demonstrated repeatedly (now at `moonflow-v5`).

Depends on: everything above

## Phase 6 — Ship
**T25 — Deploy + publish both install links** ✅ done — GitHub Pages via `.github/workflows/deploy-pages.yml` (deploys `moonflow-app/` on every push to `main`). Repo made public to allow it — GitHub Pages is blocked outright for private repos on the free plan (see ADR-023, and the design-system.md tech-stack table which listed it as one of several equally-viable options). Verified both links live: HTTPS, service worker registers, manifest fetches correctly, zero console errors.
  - Real icon: https://dharanish-v.github.io/moonflow/index.html
  - Discreet icon: https://dharanish-v.github.io/moonflow/planner.html
**T26 — Full `moonflow-qa-checklist.md` run-through on a real iPhone** — needs an actual device; everything checkable from a dev machine (all of Phases 0–5, offline behavior, PIN lockout, draft autosave, export, a11y markup) has been. Remaining are the truly device-only items: native Add-to-Home-Screen icon/name, real Share Sheet (this dev environment's Chrome doesn't support file-sharing, confirmed falls back to download correctly), VoiceOver swipe order, Safari text-zoom, and the grayscale-screenshot check. No Xcode/iOS Simulator available in this environment either (no Apple ID) — real-iPhone-viewport checks below used Chrome's device-emulation mode (real Chromium engine, iPhone-sized viewport + spoofed UA, not actual WebKit/Safari) as the closest available substitute.

**Bug found via iPhone-viewport emulation (real, not a Simulator quirk):** the floating tab bar's `max-width: 26rem` + `margin: auto` centering only creates a horizontal margin when the viewport is *wider* than 416px — true of desktop, false of literally every real iPhone. On any real device the tab bar rendered edge-to-edge with zero margin, clipping its rounded corners flush against the screen edges — directly contradicting the design system's "floating inset capsule... margin on all sides so it visibly floats." Fixed in both `index.html` and `planner.html` with `width: min(26rem, calc(100% - 2 * var(--space-4)))` + `box-sizing: border-box` (the first attempt forgot the box-sizing change and the padding silently re-consumed the exact margin the calc carved out — caught by checking actual rendered geometry, not just the CSS source). Verified: 14px margin both sides at a 393px iPhone-width viewport, still correctly caps at 416px and centers on desktop widths — no regression.

**Second, more visible bug caught by the user directly** (screenshots throughout this whole session showed it, but it read as "just how the screenshot cropped" rather than registering as wrong): the tab bar used `position: sticky`, which only actually sticks once its containing block has real scroll room. On any screen shorter than the viewport — nearly all of them — there's nothing to scroll, so it just rendered in normal document flow directly below the content instead of pinning to the bottom of the screen, leaving a large empty gap beneath it. Fixed by switching to `position: fixed` (anchors to the viewport unconditionally) in both `index.html` and `planner.html`, plus reserving matching bottom clearance in `#app-content`'s padding so scrolled content is never hidden behind the now-fixed bar. Verified: bar's bottom edge sits exactly at the viewport's bottom edge regardless of content height; content on a deliberately cramped 400px-tall viewport still scrolls fully clear of the bar (checked actual bounding-rect overlap, not just visually).

**Third, systemic issue found via a full `/impeccable adapt` responsive audit (ADR-024):** measuring actual rendered geometry (not visual review) turned up 44×44px touch-target violations across nearly the entire app — tab bar icons at 19×19px, Save/Get-started buttons at 32-35px tall, flow pills and symptom chips at 26px tall, the mood picker at 32×32px, stepper buttons at 22×22px, calendar cells at 24×24px, month-nav arrows at ~26×29px, and the log-entry sheet's Close/Clear controls. Also caught the Settings "Export data" row being inconsistent with the other three T23 rows (only its 24×27px chevron was clickable, not the full row). Fixed everywhere, with two deliberate documented exceptions matching real native conventions rather than blanket rule-following: the toggle switch (51×31px, Apple's UISwitch proportions) and calendar day cells (40×40px, the largest that fits a 7-column grid on real iPhone widths). Re-verified every screen's geometry after the fix: zero controls under 44px outside the two exceptions, zero new horizontal overflow.

**Fourth, a real functional gap the user caught directly** ("there are 3 buttons to open one screen, how is this good UX?"): the home screen's Flow/Mood/Symptom quick-action buttons all opened the identical log-entry screen at the identical scroll position — `mountHomeScreen`'s `onQuickAction(kind)` callback was wired all the way through from the button click, then silently discarded at the one call site in `app.js` that mattered (`onQuickAction: () => ...` — the `kind` parameter was never even named). Three visually distinct shortcuts delivered exactly one destination; tapping "Mood" gave zero benefit over tapping "Flow" — still had to scroll past Flow and Symptoms manually either way. Fixed: `kind` now flows into `state.logFocusSection`, and `mountLogEntryScreen` scrolls to and focuses the matching section (`#log-field-flow`/`-symptom`/`-mood`) on open — real for keyboard/VoiceOver users too, not just a visual scroll. The calendar's edit-a-past-day path explicitly clears `logFocusSection` so it never inherits a stale target from an earlier quick-action tap. 4/4 new tests in `tests/log-entry-focus-tests.html`, verified live: each button now provably focuses its own section (checked `document.activeElement`, not just appearance).

**Fifth, and the most fundamental: the app had never actually been seen correctly** (ADR-025). The user has no iPhone and has been viewing every build this whole session through a normal desktop browser window — where every screen rendered as a small clump of UI pinned to the top-left corner of a huge flat black void, no padding, nothing explaining why. `tokens.css` already had `--bg-frame` ("Device frame...") and `--radius-frame` ("...Device frame radius") documented since Phase 0, but `--bg-frame` was only ever wired to a toggle knob and `--radius-frame` was used nowhere — the original design always intended a real device-frame presentation for non-phone viewports; it just never got built. Added `#phone-frame` (wraps `#app-content` + `#tab-bar`, `index.html` + `planner.html`): below 27rem, identical to before (edge-to-edge, no frame — an actual iPhone never sees a difference); at 27rem and up, a centered, fixed-size (393×852px) simulated phone screen with rounded corners, a soft shadow, and its own internal scroll, on a `--bg-frame`-colored backdrop. `transform: translateZ(0)` gives the fixed-position tab bar a containing block so it stays pinned to the simulated screen, not the real browser window. Verified: narrow viewports pixel-identical to before, no dead-space gap at the breakpoint transition, tab bar measurably confined to the frame (not the window) and stays fixed during the frame's own internal scroll.

**Sixth, the framing fix wasn't the whole story** (ADR-026): the user pushed back again after ADR-025 shipped — "still there are lot of unused real estate, the design isn't good" — correctly pointing out that even at *real phone dimensions* (not just the desktop-frame case), Home/onboarding/PIN-lock/Insights-empty still pinned their content to the top with a large dead gap above the tab bar. Root cause: `.screen` had no vertical layout rule at all, and `#phone-frame` only ever had `min-height`, never a definite `height` — so a `min-height:100%`/`flex:1` on any descendant had nothing resolvable to fill. Fixed by giving `#phone-frame` a real height at every width, making `#app-content`/`.screen` a flex column down the chain, and adding a `.screen--centered` modifier applied only where the design intent is a single composed centerpiece (Home, onboarding, PIN lock, Insights' empty state) — not to Calendar or Settings, which are scannable lists and correctly stay top-anchored, or the log-entry sheet, which is a partial-height sheet and correctly does not stretch. Verified via screenshot at real iPhone-emulated dimensions (393×852) and at the desktop-framed breakpoint; full regression suite re-run green across all 8 test files (pin-auth, log-entry-draft, export, accessibility, animation/gesture, web-vitals, cycle-math, log-entry-focus); Calendar and Settings re-screenshotted to confirm no change.

**Seventh, caught during the user's own "check the other screens" follow-up:** live-verifying the Sixth fix on production, then seeding realistic sparse data (2-3 logged cycles) and checking Insights, reproduced the exact same complaint on a screen this round had explicitly signed off as "correctly top-anchored." Its stat cards + chart + one symptom row filled barely a third of the screen for anyone who hasn't been tracking long — a large dead gap survived because "Insights has data" isn't actually a genuine open-ended list the way Settings/Calendar are: `computeInsights()` hard-caps it at 6 chart bars and 3 symptom rows, so it's really a small bounded report, closer in kind to Home's glance. Fixed by keeping the "Insights" title top-anchored (page identity, matches Settings) while wrapping the stats/chart/symptoms group in a new `.insights-body` (`flex:1; justify-content:center`) so that bounded group centers in whatever space is left below the title. Verified both ends of the range live: 3-cycle sparse data now centers with no gap; artificially maxed-out data (8 cycles, hitting both the 6-bar and 3-symptom-row caps) still renders with zero overflow or top-clipping — confirmed by checking `.insights-body`'s `scrollHeight` exactly matched its rendered height at both extremes, not just eyeballing it. Also caught along the way: seeding test data through raw IndexedDB surfaced that the onboarded-flag setting key is `onboardingComplete`, not `onboarded` — no product bug, just a note for any future test-data script.

**Eighth, and the most serious of the responsive bugs** (ADR-027): the user reported the app "looks like desktop in mobile also" on their own phone. Reproduced by emulating a real Android touchscreen at 480×900 — a perfectly ordinary width for large modern phones — and it showed the exact desktop-framed treatment (floating simulated phone, black void backdrop, shadow) that ADR-025 built specifically to distinguish desktop browser windows from real phones. Root cause: the framing breakpoint (`@media (min-width: 27rem)`) tested only viewport width, silently assuming "narrow = phone, wide = desktop" — true only for the single iPhone width (393px) this project had been testing against, false for the real Android device landscape where many phones report CSS widths well past 27rem. Fixed by adding `(hover: hover) and (pointer: fine)` to the same breakpoint in both `index.html` and `planner.html` — real touchscreens report `(hover: none)`/`(pointer: coarse)` regardless of their width, so the frame now requires *both* wide and mouse-driven, not width alone. Verified all three real cases directly: narrow iPhone touchscreen (393px, unaffected), wide Android touchscreen (480px, frame now correctly gone), desktop mouse window (1440px, frame correctly still there). Full accessibility suite re-confirmed 11/11 (pure CSS-condition change, no logic touched).

Depends on: T1–T24

---

## Backlog — V2 & Explorations
*Deliberately left loose, not broken into tickets yet — that's its own future work, once V1 has actually shipped and been lived with for a cycle or two.*

**V2 (see `moonflow-design-system.md`)**
- Push reminders — needs a minimal server-side relay (a device token + a reminder date only, never cycle data)
- BBT / ovulation-test logging
- Irregular-cycle handling improvements
- Light theme — the token architecture (ADR-016) is already built for this; needs real design values for a `[data-theme="light"]` block, including a from-scratch `--glass-fill` value, not a mechanical inversion

**AI exploration (not committed — see ADR-013)**
- Natural-language logging ("heavy flow, bad cramps, low mood" → structured fields)
- Pattern-finding across free-text notes
- Plain-language queries against your own data, answered via a real database lookup — never a model-recalled fact
- All three would share one small on-device model (LiteRT.js, WebLLM, or Transformers.js — all confirmed feasible on iOS 26 Safari), gated behind its own opt-in "Smart features" toggle given the size cost (~500MB–1GB), and would need a new ADR explicitly superseding ADR-013 before any of it starts
