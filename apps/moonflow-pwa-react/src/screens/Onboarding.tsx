// src/screens/Onboarding.tsx — first-run setup only. Ported from
// screens/onboarding.js. Rendered directly by AppGate (not a route) — see
// AppGate.tsx and router.js's original reasoning for why onboarding/pin-lock
// never get a URL.
import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { MoonIcon } from '../components/icons';
import { todayString } from '../lib/cycle-math';
import { setSetting } from '../lib/db';
import { useAppDispatch } from '../state/store';

const MIN_CYCLE_LENGTH = 15;
const MAX_CYCLE_LENGTH = 45;
const MIN_PERIOD_LENGTH = 1;
const MAX_PERIOD_LENGTH = 14;
const DEFAULT_CYCLE_LENGTH = 28;
const DEFAULT_PERIOD_LENGTH = 5;

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
        onDecrease={() => setCycleLength((n) => Math.max(MIN_CYCLE_LENGTH, n - 1))}
        onIncrease={() => setCycleLength((n) => Math.min(MAX_CYCLE_LENGTH, n + 1))}
      />

      <Stepper
        label="Average period length"
        value={periodLength}
        unit="days"
        onDecrease={() => setPeriodLength((n) => Math.max(MIN_PERIOD_LENGTH, n - 1))}
        onIncrease={() => setPeriodLength((n) => Math.min(MAX_PERIOD_LENGTH, n + 1))}
      />

      <Button disabled={!lastPeriodStart} onClick={() => void handleSubmit()} className="h-11 w-full text-flow-nav">
        Get started
      </Button>
    </div>
  );
}

function Stepper({
  label,
  value,
  unit,
  onDecrease,
  onIncrease,
}: {
  label: string;
  value: number;
  unit: string;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  const labelId = `${label.replace(/\s+/g, '-').toLowerCase()}-label`;
  return (
    <div className="mb-flow-6">
      <span id={labelId} className="mb-flow-2 block text-flow-caption text-muted-foreground">
        {label}
      </span>
      <div role="group" aria-labelledby={labelId} className="flex items-center justify-between rounded-md bg-card px-flow-4 py-flow-3">
        <Button
          type="button"
          variant="outline"
          size="icon-touch"
          className="rounded-full"
          aria-label={`Decrease ${label.toLowerCase()}`}
          onClick={onDecrease}
        >
          &minus;
        </Button>
        <span className="text-flow-body text-foreground">
          {value} {unit}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-touch"
          className="rounded-full"
          aria-label={`Increase ${label.toLowerCase()}`}
          onClick={onIncrease}
        >
          +
        </Button>
      </div>
    </div>
  );
}
