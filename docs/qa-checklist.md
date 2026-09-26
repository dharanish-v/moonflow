# Moonflow — QA / Test Checklist

Most behaviour is covered by the automated suite (`npm test`, 300+ Vitest/Testing Library/jest-axe tests plus build guards, run in CI on every push). This checklist covers what only a real iPhone can confirm. Run it on-device before calling a release done.

## Onboarding & first run
- [ ] Fresh install with zero data shows the onboarding screen, not a broken/empty home screen
- [ ] Completing onboarding produces a reasonable first prediction, clearly marked as estimated
- [ ] The date picker opens and only allows past dates
- [ ] Opened in a Safari tab, onboarding warns to Add to Home Screen first
- [ ] "Restore from a backup" imports an encrypted backup on a fresh install

## Logging
- [ ] Logging today and reopening the app reflects it correctly on the home screen's moon-phase illustration
- [ ] Backgrounding mid-entry (before Save) and reopening restores the draft, not a blank form
- [ ] Rapidly double-tapping Save does not create two entries for the same day (upsert, not append)
- [ ] Editing an existing day pre-fills its previous values
- [ ] Clearing a day's log removes it and updates predictions accordingly
- [ ] A Spotting-only day never gets treated as a period start

## Calendar
- [ ] Tapping a past date opens the log sheet for that date, pre-filled if data exists
- [ ] Tapping a future date does nothing
- [ ] Swiping left/right changes the visible month
- [ ] Legend colors match what's actually rendered for each state

## Predictions
- [ ] With 0–1 logged periods, the prediction visibly reads as "estimated"
- [ ] With 2+ periods, the prediction uses real computed history
- [ ] A highly irregular history shows a range, not a falsely precise single date
- [ ] Predictions stay correct across a simulated timezone change and a DST transition

## PIN lock
- [ ] Setting a PIN requires entering it twice before saving
- [ ] Wrong PIN is rejected; 5 wrong attempts trigger the lockout delay
- [ ] The app re-locks after being backgrounded past the timeout
- [ ] The PIN is stored as a hash, never plaintext (check in IndexedDB inspector)

## Accessibility
- [ ] VoiceOver reads every icon-only control with a meaningful label
- [ ] Increasing Safari's text-size setting doesn't break any layout
- [ ] Every interactive element is reachable via VoiceOver swipe, in a logical order
- [ ] A grayscale screenshot of each screen still makes sense (color isn't the only signal)

## PWA & install
- [ ] The install link opens correctly in Safari when shared via WhatsApp/Telegram (via "Open in Safari," not the in-app browser)
- [ ] "Add to Home Screen" produces the correct icon and name
- [ ] The app opens full-screen standalone, no Safari address bar
- [ ] The app fully works with airplane mode on
- [ ] The discreet install link produces the "Planner" icon and name correctly

## Data safety
- [ ] Export produces valid, complete JSON via the Share Sheet
- [ ] A failed IndexedDB write shows a plain inline error, never a silent loss or crash
- [ ] Force-quitting the app never loses previously-saved (non-draft) data

## Performance
- [ ] Total shipped size is measured and stays under the ~150KB target
- [ ] Insights screen code doesn't load until the Insights tab is tapped (verify in the network panel)
- [ ] No console errors or warnings on any screen
- [ ] `grep -rn '#[0-9a-fA-F]\{3,6\}' css/components.css css/screens.css` returns zero matches — confirms no hardcoded color broke the theming pattern (ADR-016)
- [ ] Chrome DevTools Lighthouse (not the npm CLI) shows a 100 performance score, with LCP, INP, and CLS each in the "Good" range (ADR-018)

## Added in the 2026-09 audit (Phases 8–11) — on-device only
- [ ] Add to Home Screen from both links: correct icon/name; Planner never shows "Moonflow" (onboarding, export filename, share title)
- [ ] Status bar text readable in both themes (light theme paints a navy band under it)
- [ ] Settings → Text Size larger/smaller: the app's text follows (Dynamic Type)
- [ ] Notes field doesn't zoom the page on focus
- [ ] Swiping the calendar left/right changes month; vertical scrolling still works
- [ ] App switcher shows a blank navy screen, not data
- [ ] PIN keypad: no iOS keyboard pops up; wrong PIN shakes; lockout countdown ticks
- [ ] Duress PIN opens an empty-looking app; relaunch + real PIN shows real data
- [ ] Export → encrypted backup → Share Sheet → Files; import it back with the passphrase
- [ ] Calendar reminders: the .ics opens in Calendar, events are titled "Reminder", alarm fires 9am the day before
- [ ] Doctor report: Print / Save as PDF produces a clean black-on-white page
- [ ] VoiceOver: Home announces the headline and "Cycle day N of M… Tonight: <moon phase>"; calendar days read their state; moods read "Very low"…"Very happy"
- [ ] Airplane mode: every screen still works after first load
- [ ] Deleting the icon really removes the data (confirms the in-app warning)
- [ ] Does IndexedDB survive an iCloud restore / Quick Start migration? (unknown — record the result in ADR log)
