// src/lib/onboarding.ts — the single atomic write onboarding makes.
import type { Settings } from './types';

export type OnboardingValues = Pick<Settings, 'lastPeriodStart' | 'avgCycleLength' | 'avgPeriodLength'>;

/** One atomic write for everything onboarding collects — a committed
 * onboardingComplete without its lastPeriodStart used to be unrenderable. */
export function submitOnboarding(values: OnboardingValues, save: (patch: Partial<Settings>) => Promise<boolean>): Promise<boolean> {
  return save({ ...values, onboardingComplete: true });
}

