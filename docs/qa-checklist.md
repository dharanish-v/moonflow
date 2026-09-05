# Moonflow — QA / Test Checklist

No automated test suite is planned at this scale (see ADR log) — this checklist is the actual safety net before calling V1 done. Run through it manually on a real iPhone.

## Onboarding & first run
- [ ] Fresh install with zero data shows the onboarding screen, not a broken/empty home screen
- [ ] Completing onboarding produces a reasonable first prediction, clearly marked as estimated
- [ ] The date field uses iOS's native wheel picker correctly

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
