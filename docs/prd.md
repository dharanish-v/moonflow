# Moonflow — Product Requirements Document (PRD)

## Problem Statement
Mainstream period trackers typically require an account, sync data to a company's servers, and are often loaded with ads or upsells — a poor fit for something this personal. This is a period tracker that requires no account, sends data nowhere, installs without an Apple Developer account or App Store review, and feels calm and private rather than clinical or cutesy.

## Goals
- A five-second daily check-in: open the app, see where you are in your cycle, log today, done
- Reasonably trustworthy predictions once 2+ real cycles of data exist
- Feels solid enough to rely on every day, for years, with effectively zero ongoing maintenance (no server to run, no account to manage, no dependency to go stale)

## Non-Goals (explicitly out of scope)
- **Not a medical diagnostic tool.** Predictions are estimates based on logged history, not medical advice, and must never be presented as a reliable method of contraception
- **Not multi-user.** No partner sharing, no caregiver access, no accounts of any kind
- **Not a fertility-coaching tool in V1.** BBT and ovulation-test logging are deferred to V2
- **Not distributed via the App Store.** Sideloaded as a PWA only (see ADR-001)
- **Not synced across devices.** Single iPhone only (see ADR-002)

## Target User
One person, on their own iPhone 17 (iOS 26). Values privacy strongly, prefers a calm and premium aesthetic over anything clinical or cutesy, and wants the option of a discreet home-screen presence.

## User Journeys
- **First run:** install from Safari → onboarding (last period date, average cycle/period length) → home screen shows an estimated first prediction
- **Daily use:** open app → glance at the moon phase for cycle day and days-to-next-period → tap Flow / Mood / Symptom → done, in about five seconds
- **Correcting a mistake:** Calendar → tap the wrong day → edit or clear that day's log
- **Periodic review:** Calendar to scan the month's pattern; Insights for averages and most-logged symptoms once enough history exists
- **Privacy moment:** Settings → PIN lock; or, at install time, choose the discreet "Planner" icon instead of the real one

## Functional Requirements
- Log period flow (None/Spotting/Light/Medium/Heavy) for any day, including past days
- See current cycle day and days-until-next-period at a glance, with no navigation required
- Log symptoms, mood, and a free-text note for any day
- View a monthly calendar showing logged periods, the predicted next period, and the fertile window
- View basic statistics — average cycle/period length, variability, most-logged symptoms — once enough history exists
- Lock the app behind a PIN
- Export all data as a JSON file at any time
- Work fully offline; install without an App Store account
- On first run, collect just enough information (last period date, average lengths) to produce a reasonable estimate before any real history exists
- Offer a discreet alternate home-screen icon, chosen at install time

## Non-Functional Requirements
- **Performance:** total app footprint (including both dependencies) stays under ~150KB; initial load feels instant on a modern iPhone
- **Privacy:** zero data leaves the device in V1 — no analytics, no tracking, no third-party network calls at runtime
- **Accessibility:** usable with VoiceOver, respects Safari's text-zoom, meets WCAG AA contrast
- **Reliability:** a draft log entry survives the app being backgrounded mid-entry; a failed save never silently loses data

## Success Criteria
- Used consistently for at least one full cycle without falling back to another app
- Install (link → working home-screen icon) takes a non-technical person under two minutes
- Predictions feel trustworthy once 2+ cycles are logged
