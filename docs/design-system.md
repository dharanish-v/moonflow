# Moonflow — Design System

The current rulebook for how Moonflow looks, sounds and behaves, matching the shipped app (2026-09-26). The reasons behind the rules are in `adr-log.md` (ADR-034 to ADR-048 cover the 2026-09 audit). Earlier versions of this file are in git history.

## Overview

- **Platform:** a home-screen web app on iPhone (Safari → Share → Add to Home Screen). Target: iPhone with iOS 26–27.
- **Philosophy:** flat and opaque wherever data lives. The one deliberate glass surface is navigation chrome.
- **Tone:** calm, private, quiet. A five-second daily glance, not a dashboard to study. No streaks, badges or gamification.
- **Built with:** shadcn/ui components (Radix, vaul) themed with Moonflow's own tokens (ADR-035, ADR-038).

## Colour

Tokens live in `src/index.css` as plain hex. They use shadcn's variable names (`--background`, `--primary`…) so every `components/ui/*` file picks them up. Dark (navy) is the default `:root`; `.light` overrides it (ADR-034). **Every text/background pair below meets WCAG AA (4.5:1) in both themes**, enforced by `build/contrast.test.ts`. Never fade text with opacity modifiers (`text-muted-foreground/60`); the test forbids it.

| Token | Dark | Light | Use |
|---|---|---|---|
| background | `#14132B` | `#F7F5EF` | Screen |
| card / popover | `#1E1C3B` | `#FFFFFF` | Cards, sheets, dialogs |
| foreground | `#F5F3EC` | `#1B1A33` | Headlines, body |
| muted | `#252346` | `#EEECF5` | Unlit moon, tracks |
| muted-foreground | `#A9A7D0` | `#5B5979` | Labels, captions |
| border / input | `#302E56` | `#DDDAE8` / `#CFCBDF` | Hairlines, fields |
| primary (gold) | `#E8C874` on `#3A2B0A` | `#8A5F00` on `#FFFFFF` | Moon, fertile window, main actions, focus ring |
| secondary (rose) | `#D99FC0` on `#4A2233` | `#A8456F` on `#FFFFFF` | Flow / period, destructive |
| accent (blue) | `#9FB8E8` | `#3F5DA8` | Symptoms, tags, selection |

**Each accent owns one meaning.** Rose is period, gold is moon/fertile/primary action, blue is symptoms and selection. Plain settings (theme) use the neutral `segment` style, never an accent.

**Status bar:** both entries use `black-translucent`. The light theme paints a navy band under it so the white status-bar text stays readable (the style is fixed at install). `theme-color` follows the resolved theme.

## Typography

- System sans (SF Pro via `-apple-system`), weights 400 / 500, and 700 for the Home headline only.
- **Dynamic Type:** `html { font: -apple-system-body }`, so the root size follows iOS Settings → Text Size, and every size is rem.
- Body text and field labels are at least `text-sm`; `text-xs` is only for captions and legends. Form fields are 16px or larger (iOS zooms on focus below that).
- No px font sizes; `build/dynamic-type.test.ts` guards this.

## Shape, spacing, touch

- Radius 12px (`--radius: 0.75rem`) for cards and fields; round for pills, keypad keys, the tab bar and the moon.
- Touch targets are **44×44px minimum**. Accepted exceptions, both matching native iOS: the toggle switch (51×31) and calendar day cells (40×40).
- Layout wraps at 200% text zoom (pills, settings rows); nothing clips.
- A device frame appears only for a mouse-driven desktop browser (`hover: hover` + `pointer: fine`), never on a touchscreen (ADR-027).

## The glass rule

Glass is for **navigation chrome only**: the tab bar and bottom sheets (log entry, export, reminders, settings editors). Sheets are 95% opaque plus blur, legible even where WebKit doesn't render the blur (a test guards this). Never glass on anything read quickly: the moon, stat cards, calendar cells, chips, charts.

## Components

| Component | Where | Notes |
|---|---|---|
| Button (default / outline / ghost / destructive) | everywhere | `components/ui/button` + `button-variants` |
| Toggle group: `pill` (flow), `chip` (symptoms), `mood`, `segment` (theme) | log sheet, settings | selection is shape as well as colour |
| Drawer (vaul) | log sheet, export, reminders, value editors | swipe down to dismiss; focus moves to the title on open |
| Alert dialog | unsaved changes, forgot PIN, erase all, import confirm | irreversible or ambiguous actions only; reversible ones use Undo |
| Undo toast | app-wide (`GlobalUndoToast`) | 6s; one slot |
| Update prompt | top of screen | "A new version is ready — Later / Update" |
| PIN keypad | lock, PIN setup/verify, duress setup | dots show progress; iOS keyboard suppressed; live lockout countdown |
| Cycle ring + moon | Home | today's real lunar phase inside the ring; the ring has a text alternative |

Icons are lucide plus a few custom SVGs (`components/icons.tsx`). Every icon-only control has an `aria-label`.

## Screens

1. **Home.** The headline (h1) is the countdown, period day, "N days late" or "Predictions paused", with an "Expected 22–26 Aug" range line (or "Estimate only — not birth control." during the fertile window). The primary action follows the day:
   - "Period started today" or "Still on my period": one tap, with Undo;
   - once today is logged, "Today: Medium flow · 2 symptoms" plus "Edit today".

   Below that: "Log symptoms, mood or notes"; a missed-period question when a cycle looks doubled; and a quiet backup reminder when due.
2. **Calendar.**
   - A real grid: swipe between months; the month heading is announced.
   - Markers: rose fill plus a droplet for logged period days, a gold outline for the fertile window, solid gold for the peak day, a dashed rose ring for predicted days, a blue dot for days with only symptoms/mood/notes. Today is an outline ring that sits alongside the others.
   - "Mark a period" picks a first and last day.
   - Estimates are labelled as estimates.
3. **Log sheet.**
   - Content: flow pills, symptom chips, a mood row (labelled "Very low…Very happy"), custom tags plus "Add tag", and notes.
   - Shortcuts: "Same as yesterday".
   - Tapping a selected option clears it.
   - Closing with changes offers Save / Discard / Keep editing.
   - "Clear this day's log" sits well below Save and is undoable.
4. **Insights.** In order:
   - average cycle, average period, "Varies by", periods logged;
   - a cycle-length chart and the most logged symptoms;
   - "When symptoms show up";
   - "Worth knowing" (FIGO health notes plus urgent-care guidance);
   - "Report for your doctor";
   - search, with recent logs.
5. **Report.** A printable summary covering 12 months; print styles are black on white with no app chrome.
6. **Settings.**
   - Appearance.
   - Security: app lock, Change PIN, duress PIN.
   - Cycle: calendar reminders, pause predictions, average lengths (with a note on when they apply), discreet icon.
   - Data: export (with "Backed up N days ago"), import, shortcut links, moving to another device.
   - Erase all data, and the medical disclaimer.
7. **Onboarding.** Native date input (the iOS wheel), average lengths, "Restore from a backup", and an install warning when opened in a Safari tab.

## App icon & discreet mode

- **Moonflow:** a gold crescent on navy. **Planner:** a charcoal notepad on cream. The choice is made at install time, from two links (ADR-011).
- The Planner install never shows "Moonflow": onboarding title and icon, export filenames and share titles, import errors, the launch shell, and calendar titles (neutral "Reminder" by default).

## Motion & feedback

- `MotionConfig reducedMotion="user"`: every animation honours the OS setting.
- The Home entrance fades once; calendar months slide in the direction of travel; a wrong PIN shakes.
- Acknowledge, then offer a way back: Undo toasts for one-tap logs, clears and marked periods. Confirmation dialogs are only for the irreversible.
- The static launch shell paints the theme background plus a glyph from the first frame, and there's no theme flash (`theme-boot.js`).
- While backgrounded, a cover hides the screen from the app-switcher snapshot.

## Edge-case rules

**Cycle maths** (lib/forecast.ts, ADR-039)
- Flow options are None / Spotting / Light / Medium / Heavy. Only Light and above count toward a period, with a 2-day gap tolerance.
- Valid cycles are 15–90 days. Predictions use the last 6 and the median, and always show a range: median ± max(2, 1.5×MAD) days, so one outlier can't stretch it (ADR-049). No fertile window is shown if it would span more than 14 days.
- "Confirmed" needs ≥2 valid cycles. A cycle ≥1.6× the median counts as a likely missed log: it's excluded, and the user is asked about it (confirmed long cycles count again).
- Irregular means a spread of ≥8 days (FIGO). Past the range is "late · N days".
- Ovulation is taken as 13 days before the period; the fertile window is widened by the range and labelled "not birth control".
- The period in progress doesn't count toward typical length.
- Dates are stored as date-only values; "today" rolls over at local midnight and on resume.

**Data safety**
- Saves are upserts by date. Multi-key writes are transactional; state updates only after a successful write.
- A failed boot read shows a retry screen, never onboarding. The draft is autosaved on backgrounding (to the database and to state).
- Import is validated: real dates, clamped lengths, a size cap, a schema version, and one transaction.

**Security** (ADR-040)
- PIN: salted PBKDF2-SHA256 (600k). Turning the lock off requires the PIN. The duress PIN opens a decoy database. Lockout is capped against clock rollback.
- A CSP (`connect-src 'none'`) means the page can make no network requests.
- Exports contain cycle data only; backups are encrypted by default.

## Tech stack

React 19, TypeScript (strict), Vite, Tailwind v4, shadcn/ui, TanStack Router (hash), Dexie, Framer Motion, vite-plugin-pwa, Vitest + Testing Library + jest-axe. See `apps/moonflow-pwa-react/README.md`.
