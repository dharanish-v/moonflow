// src/hooks/usePinAttempt.ts — one PIN check shared by the unlock screen and
// the "confirm your current PIN" screen: verify, apply lockout rules, persist
// the attempt counter, and upgrade a legacy hash after a correct entry.
import { useState } from 'react';
import { evaluatePinAttempt, hashPin, verifyPin } from '../lib/pin-auth';
import { useAppState } from '../state/store';
import { useSaveSettings } from '../state/useSaveSettings';
import { useAppDispatch } from '../state/store';

export function usePinAttempt() {
  const { settings } = useAppState();
  const dispatch = useAppDispatch();
  const saveSettingsPatch = useSaveSettings();
  const [error, setError] = useState<string | null>(null);

  async function attempt(pin: string): Promise<boolean> {
    setError(null);
    const stored = settings.pinHash ?? '';
    const { ok: matches, needsUpgrade } = stored ? await verifyPin(pin, stored) : { ok: false, needsUpgrade: false };
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
      if (needsUpgrade) void hashPin(pin).then((pinHash) => saveSettingsPatch({ pinHash }));
      return true;
    }
    setError(result.locked ? `Too many attempts — try again in ${result.secondsRemaining}s` : 'Wrong PIN');
    return false;
  }

  return { attempt, error };
}
