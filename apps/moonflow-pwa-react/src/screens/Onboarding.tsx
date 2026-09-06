// src/screens/Onboarding.tsx — first-run setup only. Ported from
// screens/onboarding.js. Rendered directly by AppGate (not a route) — see
// AppGate.tsx and router.js's original reasoning for why onboarding/pin-lock
// never get a URL.
import { useState } from 'react';
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

const STEPPER_BUTTON =
  'inline-flex size-11 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:border-border hover:text-foreground disabled:pointer-events-none disabled:opacity-50';

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
        <label htmlFor="onboarding-date" className="mb-flow-2 block text-flow-caption text-muted-foreground">
          When did your last period start?
        </label>
        <input
          type="date"
          id="onboarding-date"
          value={lastPeriodStart}
          max={todayString()}
          onChange={(e) => setLastPeriodStart(e.target.value)}
          className="w-full rounded-md border border-border bg-input/30 px-3 py-2 text-flow-body text-foreground [color-scheme:dark]"
        />
      </div>

      <div className="mb-flow-6">
        <span id="cycle-length-label" className="mb-flow-2 block text-flow-caption text-muted-foreground">
          Average cycle length
        </span>
        <div
          role="group"
          aria-labelledby="cycle-length-label"
          className="flex items-center justify-between rounded-md bg-card px-flow-4 py-flow-3"
        >
          <button
            type="button"
            className={STEPPER_BUTTON}
            aria-label="Decrease average cycle length"
            onClick={() => setCycleLength((n) => Math.max(MIN_CYCLE_LENGTH, n - 1))}
          >
            &minus;
          </button>
          <span className="text-flow-body text-foreground">{cycleLength} days</span>
          <button
            type="button"
            className={STEPPER_BUTTON}
            aria-label="Increase average cycle length"
            onClick={() => setCycleLength((n) => Math.min(MAX_CYCLE_LENGTH, n + 1))}
          >
            +
          </button>
        </div>
      </div>

      <div className="mb-flow-6">
        <span id="period-length-label" className="mb-flow-2 block text-flow-caption text-muted-foreground">
          Average period length
        </span>
        <div
          role="group"
          aria-labelledby="period-length-label"
          className="flex items-center justify-between rounded-md bg-card px-flow-4 py-flow-3"
        >
          <button
            type="button"
            className={STEPPER_BUTTON}
            aria-label="Decrease average period length"
            onClick={() => setPeriodLength((n) => Math.max(MIN_PERIOD_LENGTH, n - 1))}
          >
            &minus;
          </button>
          <span className="text-flow-body text-foreground">{periodLength} days</span>
          <button
            type="button"
            className={STEPPER_BUTTON}
            aria-label="Increase average period length"
            onClick={() => setPeriodLength((n) => Math.min(MAX_PERIOD_LENGTH, n + 1))}
          >
            +
          </button>
        </div>
      </div>

      <button
        type="button"
        disabled={!lastPeriodStart}
        onClick={handleSubmit}
        className="min-h-11 w-full rounded-lg bg-primary text-flow-nav font-medium text-primary-foreground transition-colors disabled:pointer-events-none disabled:opacity-50"
      >
        Get started
      </button>
    </div>
  );
}
