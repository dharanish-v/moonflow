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
**T24 — Web Vitals pass** (S) — optimistic Save UI, explicit SVG dimensions, confirm no CLS on skeleton swap

**Bugs found + fixed along the way (Phase 5):**
- `service-worker.js`'s `CACHE_VERSION` was never bumped after Phase 4, so its cache-first strategy was silently serving pre-Phase-4 `app.js`/`settings.js`/`calendar.js`/`log-entry.js`, and `pin-auth.js`/`export.js`/`screens/pin-lock.js` were never added to `PRECACHE_FILES` at all — meaning PIN lock and export would have failed outright in airplane mode (breaks the "fully works with airplane mode on" QA item, for a security feature no less). Fixed, verified live fully offline.
- Deeper cause of the same class of bug (see ADR-022): `cache.addAll()`'s own fetches were still subject to the *browser's* HTTP cache, so a `CACHE_VERSION` bump alone didn't guarantee fresh bytes — reproduced concretely while testing T22 (a CSS edit + version bump still served stale styles). Fixed with `{cache: 'reload'}` on every precache request; now at `moonflow-v4`.
- **Reminder for future work:** every new file added to `PRECACHE_FILES` (like `gestures.js` this round) and every `CACHE_VERSION` bump must happen together, every time a cached file changes — easy to forget mid-feature-work, as this phase demonstrated twice.

Depends on: everything above

## Phase 6 — Ship
**T25 — Deploy + publish both install links**
**T26 — Full `moonflow-qa-checklist.md` run-through on a real iPhone**

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
