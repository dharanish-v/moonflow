// src/screens/Onboarding.tsx — first-run setup only. Ported from
// screens/onboarding.js. Rendered directly by AppGate (not a route) — see
// AppGate.tsx and router.js's original reasoning for why onboarding/pin-lock
// never get a URL.
import { useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Calendar } from '../components/ui/calendar';
import { Label } from '../components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Stepper } from '../components/Stepper';
import { MoonIcon } from '../components/icons';
import {
  DEFAULT_CYCLE_LENGTH,
  DEFAULT_PERIOD_LENGTH,
  MAX_CYCLE_LENGTH,
  MAX_PERIOD_LENGTH,
  MIN_CYCLE_LENGTH,
  MIN_PERIOD_LENGTH,
} from '../lib/constants';
import { formatDate, parseDate } from '../lib/cycle-math';
import type { Settings } from '../lib/types';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useSaveSettings } from '../state/useSaveSettings';

type OnboardingValues = Pick<Settings, 'lastPeriodStart' | 'avgCycleLength' | 'avgPeriodLength'>;

/** One atomic write for everything onboarding collects — a committed
 * onboardingComplete without its lastPeriodStart used to be unrenderable. */
export function submitOnboarding(values: OnboardingValues, save: (patch: Partial<Settings>) => Promise<boolean>): Promise<boolean> {
  return save({ ...values, onboardingComplete: true });
}

export function OnboardingScreen() {
  const saveSettingsPatch = useSaveSettings();
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [lastPeriodStart, setLastPeriodStart] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [cycleLength, setCycleLength] = useState(DEFAULT_CYCLE_LENGTH);
  const [periodLength, setPeriodLength] = useState(DEFAULT_PERIOD_LENGTH);

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
    }
  }

  return (
    <div className="mx-auto box-border flex w-full max-w-[26rem] flex-1 flex-col justify-center px-4 py-5">
      <div className="mx-auto mb-3.5 flex size-11 items-center justify-center rounded-full bg-primary/15 text-primary">
        <MoonIcon className="size-5" />
      </div>
      <h1 className="mb-1 text-center text-base font-medium text-foreground">Let's set up Moonflow</h1>
      <p className="mb-5 text-center text-xs text-muted-foreground">
        Just enough to make your first prediction
      </p>

      <div className="mb-5">
        <Label id="onboarding-date-label" className="mb-1.5 block text-xs text-muted-foreground">
          When did your last period start?
        </Label>
        <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              aria-labelledby="onboarding-date-label onboarding-date-value"
              className="h-11 w-full justify-start gap-1.5 font-normal"
            >
              <CalendarIcon className="size-4 text-muted-foreground" aria-hidden="true" />
              <span id="onboarding-date-value" className={lastPeriodStart ? 'text-foreground' : 'text-muted-foreground'}>
                {lastPeriodStart ? parseDate(lastPeriodStart).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : 'Select a date'}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)]">
            <Calendar
              mode="single"
              selected={lastPeriodStart ? parseDate(lastPeriodStart) : undefined}
              onSelect={(date) => {
                if (!date) return;
                setLastPeriodStart(formatDate(date));
                setDatePickerOpen(false);
              }}
              disabled={{ after: new Date() }}
            />
          </PopoverContent>
        </Popover>
      </div>

      <Stepper
        label="Average cycle length"
        value={cycleLength}
        unit="days"
        min={MIN_CYCLE_LENGTH}
        max={MAX_CYCLE_LENGTH}
        onChange={setCycleLength}
      />

      <Stepper
        label="Average period length"
        value={periodLength}
        unit="days"
        min={MIN_PERIOD_LENGTH}
        max={MAX_PERIOD_LENGTH}
        onChange={setPeriodLength}
      />

      <p className="mb-3.5 text-center text-xs text-muted-foreground">
        This gives you a starting guess — logging each cycle makes it sharper over time.
      </p>

      {saveError && (
        <Alert className="mb-2">
          <AlertDescription>Couldn't save — try again</AlertDescription>
        </Alert>
      )}
      <Button disabled={!lastPeriodStart || isSaving} onClick={() => void handleSubmit()} className="h-11 w-full text-sm">
        Get started
      </Button>
    </div>
  );
}
