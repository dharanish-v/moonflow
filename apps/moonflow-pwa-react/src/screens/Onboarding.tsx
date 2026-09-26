// src/screens/Onboarding.tsx — first-run setup only. Ported from
// screens/onboarding.js. Rendered directly by AppGate (not a route) — see
// AppGate.tsx and router.js's original reasoning for why onboarding/pin-lock
// never get a URL.
import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Stepper } from '../components/Stepper';
import { CalendarDays } from 'lucide-react';
import { MoonIcon } from '../components/icons';
import {
  DEFAULT_CYCLE_LENGTH,
  DEFAULT_PERIOD_LENGTH,
  MAX_CYCLE_LENGTH,
  MAX_PERIOD_LENGTH,
  MIN_CYCLE_LENGTH,
  MIN_PERIOD_LENGTH,
} from '../lib/constants';
import { todayString } from '../lib/cycle-math';
import { isFutureDate, isRealDate } from '../lib/dates';
import { submitOnboarding } from '../lib/onboarding';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useSaveSettings } from '../state/useSaveSettings';
import { isDiscreetInstall, isStandalone } from '../lib/install-identity';
import { ImportBackup } from '../components/ImportBackup';

export function OnboardingScreen() {
  const discreet = isDiscreetInstall();
  const saveSettingsPatch = useSaveSettings();
  // Three short steps (T93): your cycle → private by design → keep it safe.
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [lastPeriodStart, setLastPeriodStart] = useState('');
  const [cycleLength, setCycleLength] = useState(DEFAULT_CYCLE_LENGTH);
  const [periodLength, setPeriodLength] = useState(DEFAULT_PERIOD_LENGTH);
  const [wantPin, setWantPin] = useState(false);

  async function handleSubmit() {
    if (!lastPeriodStart || isSaving) return;
    setIsSaving(true);
    setSaveError(false);
    const ok = await submitOnboarding(
      { lastPeriodStart, avgCycleLength: cycleLength, avgPeriodLength: periodLength },
      saveSettingsPatch,
    );
    if (!ok) {
      setIsSaving(false);
      setSaveError(true);
      return;
    }
    // Hash router: go straight to PIN setup once the app opens.
    if (wantPin) window.location.hash = '#/settings/pin-setup';
  }

  return (
    <div className="mx-auto box-border flex w-full max-w-[26rem] flex-1 flex-col justify-center px-4 py-5">
      <p className="mb-3 text-center text-xs text-muted-foreground" aria-live="polite">
        Step {step} of 3
      </p>

      {step === 1 && (
        <>
          <div className="mx-auto mb-3.5 flex size-11 items-center justify-center rounded-full bg-primary/15 text-primary">
            {discreet ? <CalendarDays className="size-5" aria-hidden="true" /> : <MoonIcon className="size-5" />}
          </div>
          <h1 className="mb-1 text-center text-base font-medium text-foreground">
            {discreet ? "Let's get set up" : "Let's set up Moonflow"}
          </h1>
          <p className="mb-5 text-center text-xs text-muted-foreground">Just enough to make your first prediction</p>
          {/* Before anything is entered: a Safari tab's data never reaches the installed app. */}
          {!isStandalone() && (
            <Alert className="mb-4">
              <AlertDescription>
                Install it first: tap Share, then <strong>Add to Home Screen</strong>, and open it from there. Anything you
                enter in this browser tab stays in the tab — the installed app won't see it.
              </AlertDescription>
            </Alert>
          )}

          <div className="mb-5">
            <Label htmlFor="onboarding-date" className="mb-1.5 block text-sm text-muted-foreground">
              When did your last period start?
            </Label>
            {/* Native input: iOS shows its own date wheel (design-system.md), and
                max stops a future date. No date-picker library needed. */}
            <Input
              id="onboarding-date"
              type="date"
              max={todayString()}
              value={lastPeriodStart}
              onChange={(e) => setLastPeriodStart(isRealDate(e.target.value) && !isFutureDate(e.target.value) ? e.target.value : '')}
              className="h-11"
            />
          </div>

          <Stepper label="Average cycle length" value={cycleLength} unit="days" min={MIN_CYCLE_LENGTH} max={MAX_CYCLE_LENGTH} onChange={setCycleLength} />
          <Stepper label="Average period length" value={periodLength} unit="days" min={MIN_PERIOD_LENGTH} max={MAX_PERIOD_LENGTH} onChange={setPeriodLength} />

          <p className="mb-3.5 text-center text-xs text-muted-foreground">
            This gives you a starting guess — logging each cycle makes it sharper over time.
          </p>
          <Button disabled={!lastPeriodStart} onClick={() => setStep(2)} className="h-11 w-full text-sm">
            Next
          </Button>

          {/* New phone: bring the old one's backup straight in instead. */}
          <ImportBackup>
            {(pick) => (
              <Button variant="ghost" onClick={pick} className="mt-2 h-11 w-full text-sm text-muted-foreground">
                Restore from a backup
              </Button>
            )}
          </ImportBackup>
        </>
      )}

      {step === 2 && (
        <>
          <h1 className="mb-3 text-center text-base font-medium text-foreground">Private by design</h1>
          <ul className="mb-5 flex flex-col gap-2 text-sm text-foreground">
            <li>Everything you log stays on this phone. There's no account and no server.</li>
            <li>The app can't send data anywhere; its security policy blocks every network request.</li>
            <li>Backups are encrypted with a passphrase only you know.</li>
            <li>Predictions are estimates, not medical advice, and never birth control.</li>
          </ul>
          <Button onClick={() => setStep(3)} className="h-11 w-full text-sm">
            Next
          </Button>
          <Button variant="ghost" onClick={() => setStep(1)} className="mt-2 h-11 w-full text-sm text-muted-foreground">
            Back
          </Button>
        </>
      )}

      {step === 3 && (
        <>
          <h1 className="mb-3 text-center text-base font-medium text-foreground">Keep it safe</h1>
          <p className="mb-4 text-sm text-muted-foreground">
            Your data lives only in this home-screen app: removing the icon deletes it. Export a backup now and then from
            Settings.
          </p>
          <label className="mb-5 flex min-h-11 items-center gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={wantPin}
              onChange={(e) => setWantPin(e.target.checked)}
              className="size-5 accent-[var(--primary)]"
            />
            Set up a PIN lock next
          </label>
          {saveError && (
            <Alert className="mb-2">
              <AlertDescription>Couldn't save — try again</AlertDescription>
            </Alert>
          )}
          <Button disabled={isSaving} onClick={() => void handleSubmit()} className="h-11 w-full text-sm">
            Get started
          </Button>
          <Button variant="ghost" onClick={() => setStep(2)} className="mt-2 h-11 w-full text-sm text-muted-foreground">
            Back
          </Button>
        </>
      )}
    </div>
  );
}
