// src/screens/Onboarding.tsx — first-run setup only. Ported from
// screens/onboarding.js. Rendered directly by AppGate (not a route) — see
// AppGate.tsx and router.js's original reasoning for why onboarding/pin-lock
// never get a URL.
import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
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
import { todayString } from '../lib/cycle-math';
import { setSetting } from '../lib/db';
import { useAppDispatch } from '../state/store';

export function OnboardingScreen() {
  const dispatch = useAppDispatch();
  const [lastPeriodStart, setLastPeriodStart] = useState('');
  const [cycleLength, setCycleLength] = useState(DEFAULT_CYCLE_LENGTH);
  const [periodLength, setPeriodLength] = useState(DEFAULT_PERIOD_LENGTH);

  async function handleSubmit() {
    if (!lastPeriodStart) return;
    await Promise.all([
      setSetting('lastPeriodStart', lastPeriodStart),
      setSetting('avgCycleLength', cycleLength),
      setSetting('avgPeriodLength', periodLength),
      setSetting('onboardingComplete', true),
    ]);
    dispatch({
      type: 'PATCH_SETTINGS',
      patch: { lastPeriodStart, avgCycleLength: cycleLength, avgPeriodLength: periodLength, onboardingComplete: true },
    });
  }

  return (
    <div className="mx-auto box-border flex w-full max-w-[26rem] flex-1 flex-col justify-center px-flow-5 py-flow-6">
      <div className="mx-auto mb-flow-4 flex size-11 items-center justify-center rounded-full bg-primary/15 text-primary">
        <MoonIcon className="size-5" />
      </div>
      <h1 className="mb-flow-1 text-center text-flow-title font-medium text-foreground">Let's set up Moonflow</h1>
      <p className="mb-flow-6 text-center text-flow-caption text-muted-foreground">
        Just enough to make your first prediction
      </p>

      <div className="mb-flow-6">
        <Label htmlFor="onboarding-date" className="mb-flow-2 block text-flow-caption text-muted-foreground">
          When did your last period start?
        </Label>
        <Input
          type="date"
          id="onboarding-date"
          value={lastPeriodStart}
          max={todayString()}
          onChange={(e) => setLastPeriodStart(e.target.value)}
          className="h-11"
        />
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

      <Button disabled={!lastPeriodStart} onClick={() => void handleSubmit()} className="h-11 w-full text-flow-nav">
        Get started
      </Button>
    </div>
  );
}
