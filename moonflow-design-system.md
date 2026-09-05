# Moonflow — Design System (v1, Frozen)

**What this document is:** Moonflow's own custom design system — not an adoption of Material, Bootstrap, or any other existing one. It's the rulebook (palette, type, spacing, component specs). The **component library** — the actual reusable HTML/CSS blocks that implement these rules (`.chip`, `.toggle`, `.moon-phase`, `.tab-bar`, `.card`) — is the next step, built fresh to match this spec exactly.

**Companion documents:** `moonflow-prd.md` covers *what* problem this solves and for whom — read that one first, logically. `moonflow-adr-log.md` covers *why* each technical decision was made, as an immutable historical log. `moonflow-technical-design.md` is the concrete blueprint (schema, state shape, file structure, algorithms). `moonflow-qa-checklist.md`, `moonflow-readme.md`, and `moonflow-copy-deck.md` round out testing, deployment, and user-facing text.

**Frozen:** September 4, 2026 — before implementation begins. Any visual change after this point should be a deliberate edit to this doc, not a one-off in code.

## Overview

- **Platform:** iOS PWA, installed via Safari → Share → "Add to Home Screen." Targeting iPhone 17 / iOS 26.
- **Philosophy:** flat and opaque everywhere data lives; one deliberate glass exception, reserved for floating navigation chrome only.
- **Tone:** calm, private, quiet. A five-second daily glance — not a dashboard to study.

## Color Palette

### Base
| Token | Hex | Use |
|---|---|---|
| bg-screen | `#14132B` | Screen background |
| bg-frame | `#0A0918` | Device frame, notch, toggle knobs |
| surface-card | `#1E1C3B` | Cards, buttons, unselected chip fill |
| border-hairline | `#252346` | Dividers, chart track background |
| border-muted | `#302E56` | Unselected button/chip borders |

### Text
| Token | Hex | Use |
|---|---|---|
| text-primary | `#F5F3EC` | Headlines, numbers, active labels |
| text-secondary | `#CBC9E8` | Body labels, unselected calendar days |
| text-muted | `#8F8DB8` | Section labels, meta text |
| text-inactive | `#5F5D85` | Inactive icons, chevrons |

### Accents — each owns one meaning; never swap them
| Token | Hex | Meaning | Text-on-fill |
|---|---|---|---|
| accent-rose | `#D99FC0` | Flow / period | `#4A2233` |
| accent-gold | `#E8C874` | Moon / mood / ovulation | `#3A2B0A` |
| accent-blue | `#9FB8E8` | Symptoms | used at low opacity; text stays accent-blue |
| moon-unlit | `#2A2850` | Dark/unlit portion of the home screen's moon-phase illustration | — |

### Glass (tab bar + log-entry sheet only)
| Token | Value |
|---|---|
| glass-fill | `rgba(72,68,120,0.45)` |
| glass-border | `rgba(255,255,255,0.14)` |
| glass-blur (real build) | `backdrop-filter: blur(16–20px)` |

## Typography

Single system sans-serif (SF Pro / `-apple-system`). Two weights only: 400 regular, 500 medium.

| Size | Weight | Use |
|---|---|---|
| 32px | 500 | Hero number (cycle day) |
| 20px | 500 | Stat card values |
| 15px | 500 | Screen titles |
| 13px | 500 | Nav labels, header text |
| 12px | 400 | Body text, settings rows |
| 11px | 400 | Secondary labels, buttons |
| 10px | 400 | Chips, legend, tab labels |
| 9px | 400 | Chart axis labels — floor, never smaller |

## Shape & Spacing

- Card / chip radius: **12px**
- Pill radius: **10px** rectangular; fully round for circular icons and the tab bar (**22px**)
- Device frame radius: **36px**
- **The device frame is gated on input type, not just width** (ADR-027): it only ever appears for a mouse-driven desktop browser window (`hover: hover` and `pointer: fine`) above the content's own max-width — never for a real touchscreen, regardless of how wide that phone reports its CSS viewport (many real Android phones exceed the iPhone-width reference this app was first tested against). A width-only breakpoint can't tell a real large phone apart from a resized desktop window; input type can.
- Spacing rhythm: 4 / 6 / 8px for tight clusters, 14–20px between sections
- Borders are always **0.5px** — hairline-thin, never heavier
- **Touch targets are 44×44px minimum** (WCAG/Apple HIG) on every interactive control — buttons, pills, chips, the mood picker, the stepper, calendar nav arrows, the tab bar, and full-row settings items. Two accepted exceptions, both matching real native conventions rather than one-off shortcuts: the **toggle switch** (51×31px, Apple's own UISwitch size — a binary control where an adjacent mis-tap costs nothing) and **calendar day cells** (40×40px — the largest size that fits a 7-column grid across the real iPhone width range alongside the screen's own padding; Apple's Calendar/Health apps make the same tradeoff for dense date grids, and a mis-tap there just lands on an adjacent day)
- **Vertical placement follows composition, not a blanket rule** (ADR-026): a screen that is one centered composition — icon/illustration + title + a line or two, nothing to scan — vertically centers within the available screen height (`.screen--centered`): Home (the "five-second glance"), onboarding, and PIN lock. A screen that is a genuinely open-ended list a user scans from the top — Calendar's grid, Settings' rows — stays top-anchored, because centering a list just moves its starting point around unpredictably as content length varies. Insights sits in between: its title stays top-anchored (a page identity, like Settings'), but its content below — stat cards, chart, symptom rows, all hard-capped (max 6 chart bars, max 3 symptom rows, or the "not enough history yet" empty state) — centers in the remaining space via `.insights-body`, since a small bounded report reads more like a glance than an open list, and centering it is safe precisely because it can never grow past what's been measured to fit. The log-entry sheet is neither — a partial-height sheet, not a full screen — and never stretches to fill available space regardless.

## Components

- **Quick-action button** — flat card, 0.5px border-muted, icon above label, no fill unless active
- **Chip (symptom)** — pill; unselected = transparent + border-muted + text-muted; selected = 18% accent tint + accent border + accent text
- **Toggle** — 51×31px track (Apple UISwitch proportions — see the touch-target note above); gold = on, border-muted = off; knob always bg-frame
- **Moon-phase illustration** — the actual current lunar phase, rendered via an offset-circle technique (a lit gold circle with a dark circle overlapping to carve the correct phase shape) plus a subtle dot-grain texture on the lit portion, for an illustrated rather than flat-vector quality; a small rose dot marks the fertile-window day. Replaces an earlier abstract progress-ring concept — literal and tied to the app's name, not a decorative metaphor (ADR-019)
- **Bar chart** — flat gold bars, rounded top corners only, no gridlines
- **Tab bar (the one glass element)** — floating inset capsule, glass-fill + glass-border, margin on all sides so it visibly floats above content
- **Log-entry sheet** — slides up as a frosted modal over a dimmed background, same glass treatment as the tab bar

## The Glass Rule

Glass is reserved for **navigation chrome only** — the tab bar and the log-entry sheet. It is never applied to anything that needs a fast read: the moon-phase illustration, stat cards, calendar cells, chips, or chart bars. This keeps the app scannable in five seconds, even in bad light or half-asleep.

## Icons

Tabler Icons, outline style, 15–19px. Set in use: `moon`, `calendar`, `chart-bar`, `settings`, `droplet`, `mood-smile`, `mood-neutral`, `mood-sad`, `mood-cry`, `mood-happy`, `notes`, `lock`, `bell`, `eye-off`, `download`, `chevron-left`, `chevron-right`, `x`.

**No emoji, anywhere — including the mood picker.** Emoji rendering is owned by Apple and shifts with iOS updates, can't be recolored to match the palette, and has known vertical-alignment quirks next to text. SVG icons stay exactly as designed regardless of OS version.

## App Icon

- **Primary icon:** solid navy (`#14132B`) background, full-bleed with no transparency (iOS applies its own rounded mask). A single gold (`#E8C874`) crescent, centered, no secondary detail — icons need to read clearly at ~60px, not just in a mockup.
- **Discreet variant:** plain cream (`#F0EEE8`) background, a simple charcoal (`#4A4A4A`) notepad glyph, labeled "Planner."
- **Constraint:** a PWA's home-screen icon is fixed at install time from whichever manifest was live when "Add to Home Screen" was tapped — it cannot be live-swapped by an in-app toggle. So the discreet icon is a choice made **at install**, via two separate install links, not a Settings switch. Switching later means removing the icon and reinstalling from the other link.

## Onboarding (first run only)

A single screen, shown once before any data exists: last period start date (native `<input type="date">` — iOS renders its own wheel picker, no custom component needed), average cycle length, average period length. Without this, the moon-phase illustration, calendar, and insights have nothing to compute a first prediction from.



1. **Home** — a literal illustration of the current moon phase (not an abstract progress ring), cycle day + status text, a small Tamil word (பிறை, "crescent") as a quiet personal signature, 3 quick-action buttons, glass tab bar. The 3 quick actions (Flow/Mood/Symptom) all open the same log-entry sheet, but each scrolls to and focuses its own section on open — they're shortcuts to the relevant part of today's entry, not three identical buttons to the same screen
2. **Calendar** — month grid; solid rose = logged period, gold tint = fertile window (peak ringed), dashed rose outline = predicted period; legend row. Tapping any past date opens the log-entry sheet for that date, pre-filled if a log exists, with a "Clear this day's log" option. Future dates are non-interactive.
3. **Log entry** — flow-intensity pills (None/Spotting/Light/Medium/Heavy), multi-select symptom chips, single-select mood row, notes field, save button
4. **Insights** — 2×2 stat cards (avg cycle, avg period, variability, cycles logged), 6-cycle bar chart, symptom-frequency bars
5. **Settings** — toggle rows (app lock, reminders, discreet icon) + value rows with chevron (cycle length, period length, theme, export)

## Locked V1 Feature Set

- Period logging (date + flow intensity)
- Cycle calendar with predictions + fertile window
- Symptom / mood / notes logging
- Home dashboard (cycle day, days to next period)
- Stats — averages + history
- PIN lock
- Local export/backup (JSON/CSV)
- Installable, offline-capable PWA
- First-run onboarding (last period date + average lengths)
- Edit or backdate past days from the calendar
- Discreet alternate icon, chosen at install time (not an in-app toggle)

## V2 — Post-Launch

- Push reminders
- BBT / ovulation-test logging
- Irregular-cycle handling
- Light theme toggle

## Edge Cases & Production Readiness

### Cycle-math rules
- Flow options are **None / Spotting / Light / Medium / Heavy** (None restored — most days have no flow at all; Spotting must never count toward period-start detection)
- Period = consecutive days at Light+ with a 2-day gap tolerance; cycle length requires 2+ real logged periods before it's computed at all
- Before enough history exists, predictions run on onboarding defaults and should visually read as estimated, not confirmed
- High cycle-length variability shows a predicted **range**, not a single date
- Averages use the **median**, not the mean, so one outlier entry can't permanently skew future predictions
- All dates stored as date-only values (no time component) — sidesteps DST/timezone bugs entirely rather than handling them

### Accessibility & device display
- `aria-label` on every icon-only control (tab bar, close, chevrons)
- `role="switch"` + `aria-checked` on toggles; a real `<label>` on the notes field, not placeholder-only
- Calendar days need a full spoken state ("September 4th, period day, today")
- Text sized in `rem`, so it respects Safari's own zoom/text-size controls (iOS system Dynamic Type is UIKit-only and doesn't reach web content directly)
- Floating tab bar uses `padding-bottom: env(safe-area-inset-bottom)` + `viewport-fit=cover`, so it clears the home-indicator area
- Portrait-locked via the manifest's `orientation` field
- Fluid layout across screen sizes, not a fixed mockup width
- 44×44px minimum touch targets on every interactive control (see Shape & Spacing) — the whole app shipped this pass with icon-only 19-32px hit areas throughout; caught by measuring actual rendered geometry, not by visual review

### Data-safety rules
- Draft log entries autosave on backgrounding (Page Visibility API), so an iOS-killed tab doesn't lose in-progress data
- Saving is an **upsert by date**, not an append — a double-tap on Save can't create duplicate records for the same day
- Every Dexie write wrapped in try/catch with a plain inline error on failure, never a silent loss

### Security & performance specifics
- PIN stored as a SHA-256 hash (Web Crypto); threat model is someone picking up an unlocked phone, not offline brute force
- Re-locks if backgrounded more than ~1–2 minutes; short lockout after repeated failed PIN attempts
- Each screen's JS loads via dynamic `import()` only when first navigated to
- Only the ~17 icons in use are inlined as SVG — never the full Tabler font
- Service worker cache is versioned, with old versions deleted in the `activate` event

### Interaction & feedback
- Screen transitions: subtle 150–200ms fade/slide, instant if `prefers-reduced-motion` is set
- Moon-phase illustration fades and scales in once on load, not on every re-render
- Log-entry sheet behaves like a native iOS sheet — slides up, swipe-down-to-dismiss
- Swipe left/right on the calendar to change months
- Brief "Saved" confirmation after logging; deleting a day's log shows "Undo" for a few seconds rather than being instantly irreversible
- No streaks or "X days in a row" gamification — deliberately avoided for a health-tracking context
- Data export goes through the native Share Sheet (`navigator.share()`), not a plain file download
- Sound is **off by default**, opt-in via Settings, limited to one or two soft, short cues if enabled — a chime firing in a quiet room would undercut the discreet-icon feature
- Numeric inputs use `inputmode="numeric"` for the correct iOS keyboard
- All animation restricted to `transform`/`opacity` (compositor-thread, stays smooth even during a busy main thread) — no animation library (ADR-015)
- Calendar month swipe uses native CSS `scroll-snap-type: x mandatory` — no JS gesture code needed
- Log-sheet swipe-to-dismiss uses the native Pointer Events API directly — no gesture library

## Tech Stack (Frozen)

**No design system, component library, or CSS framework.** Moonflow's look is fully custom (see palette and components above) — Material Design, Bootstrap, Chakra, or shadcn/ui would mean fighting their built-in visual opinions just to undo them. Hand-rolled CSS, using the palette above as CSS custom properties, keeps 1:1 fidelity to the mockups and needs no build step.

| Layer | Choice | Why |
|---|---|---|
| Markup / styling | Plain HTML + CSS (custom properties) — not Tailwind or any CSS framework | ~10 component types total; tokens already frozen above, and Tailwind's production build still requires a compile step we're deliberately avoiding |
| CSS naming | BEM (`.block__element--modifier`) | Prevents style collisions, self-documents component boundaries for solo maintenance — no build step required |
| Icons | `@tabler/icons` (SVG) | Matches every mockup exactly, MIT licensed |
| Logic | Vanilla JavaScript, no framework | No build step, smallest possible bundle, easiest to maintain solo |
| Type safety | Plain `.js` + JSDoc (`// @ts-check`) | Editor-level type checking for cycle-math and IndexedDB code — no compiler, no build step, no TypeScript |
| State management | Hand-rolled state object + subscribe pattern (~20 lines, no library) | Full re-render on screen navigation; targeted class toggles within a screen to preserve input focus; derived values (cycle day, days to next period) always computed fresh, never stored |
| Module system | Native ES Modules (`<script type="module">`, relative-path `import`/`export`) + an import map for `dexie` | Zero build step; splits code across files the same way a bundler would, without one |
| Third-party deps | Dexie self-hosted as a local file, not loaded from a CDN. No date library needed (ADR-020) | Keeps offline mode fully reliable — no runtime dependency on a third party being reachable |
| Storage | IndexedDB via Dexie.js, on-device only, local-only (no cross-device sync) | Avoids raw IndexedDB's callback API and schema-versioning bugs; gives clean queries + migrations for free |
| Installability | Web App Manifest + Service Worker | Enables "Add to Home Screen" + offline use |
| Hosting | Any static host (Vercel / Netlify / GitHub Pages / Cloudflare Pages) | No server code to run — just files over HTTPS |

**Local-only, not local-first-sync.** Single device by design — no CRDTs, no sync relay. The JSON export is the manual bridge if you ever move to a new phone. If a second synced device becomes a real need later, this data model can have sync added without a rebuild.

**Backend: none, for all of V1.** Everything — logging, predictions, calendar, insights, PIN lock, export — runs and stays entirely on your phone.

The one exception is **V2 push reminders**, which need something server-side because Apple's push service must be told when to fire a notification. Even then, that server would only ever hold a device token and a reminder date — never your actual cycle, symptom, or mood data.
