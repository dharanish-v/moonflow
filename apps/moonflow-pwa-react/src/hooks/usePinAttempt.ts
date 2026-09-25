// src/hooks/usePinAttempt.ts — one PIN check shared by the unlock screen and
// the "confirm your current PIN" screen: verify, apply lockout rules, persist
// the attempt counter, and upgrade a legacy hash after a correct entry.
import { useState } from 'react';
import { evaluatePinAttempt, hashPin, verifyPin } from '../lib/pin-auth';
import { useAppState } from '../state/store';
import { useSaveSettings } from '../state/useSaveSettings';
import { useAppDispatch } from '../state/store';

export type PinOutcome = 'real' | 'duress' | null;

/** @param allowDuress true only on the unlock screen — the duress PIN must
 * never pass "confirm your current PIN" (disabling the lock, changing it). */
export function usePinAttempt({ allowDuress = false }: { allowDuress?: boolean } = {}) {
  const { settings } = useAppState();
  const dispatch = useAppDispatch();
  const saveSettingsPatch = useSaveSettings();
  const [error, setError] = useState<string | null>(null);

  async function attempt(pin: string): Promise<PinOutcome> {
    setError(null);
    const stored = settings.pinHash ?? '';
    const real = stored ? await verifyPin(pin, stored) : { ok: false, needsUpgrade: false };
    const duress =
      !real.ok && allowDuress && settings.duressPinHash ? (await verifyPin(pin, settings.duressPinHash)).ok : false;
    const matches = real.ok || duress;
    const needsUpgrade = real.needsUpgrade;
    const result = evaluatePinAttempt({
      matches,
      failedAttempts: settings.pinFailedAttempts,
      lockoutUntil: settings.pinLockoutUntil,
      now: Date.now(),
    });

    if (result.patch) {
      // Persist the attempt counter before reacting to it; if the write
      // fails, still apply it in memory so this session's lockout holds.
      const saved = await saveSettingsPatch(result.patch);
      if (!saved) dispatch({ type: 'PATCH_SETTINGS', patch: result.patch });
    }

    if (result.ok) {
      if (duress) return 'duress';
      if (needsUpgrade) void hashPin(pin).then((pinHash) => saveSettingsPatch({ pinHash }));
      return 'real';
    }
    setError(result.locked ? `Too many attempts — try again in ${result.secondsRemaining}s` : 'Wrong PIN');
    return null;
  }

  return { attempt, error };
}
