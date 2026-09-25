// src/screens/PinUnlock.tsx — the security gate's real chrome (unlock mode
// only; see AppGate.tsx for why pin-lock isn't a route). Setting a *new* PIN
// is a separate, Settings-local flow (Settings.tsx) — it never touches
// AppGate.isLocked since it only ever runs while already unlocked.
import { useState } from 'react';
import { PinEntryForm } from '../components/PinEntryForm';
import { evaluatePinAttempt, hashPin } from '../lib/pin-auth';
import { useAppDispatch, useAppState } from '../state/store';
import { useSaveSettings } from '../state/useSaveSettings';

export function PinUnlockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { settings } = useAppState();
  const dispatch = useAppDispatch();
  const saveSettingsPatch = useSaveSettings();
  const [error, setError] = useState<string | null>(null);

  async function handleComplete(pin: string) {
    setError(null);
    const enteredHash = await hashPin(pin);
    const result = evaluatePinAttempt({
      enteredHash,
      storedHash: settings.pinHash ?? '',
      failedAttempts: settings.pinFailedAttempts,
      lockoutUntil: settings.pinLockoutUntil,
      now: Date.now(),
    });

    if (result.patch) {
      // Persist the attempt counter before reacting to it; if the write
      // fails, still apply it in memory so this session's lockout holds.
      const ok = await saveSettingsPatch(result.patch);
      if (!ok) dispatch({ type: 'PATCH_SETTINGS', patch: result.patch });
    }

    if (result.ok) {
      onUnlock();
      return;
    }
    setError(result.locked ? `Too many attempts — try again in ${result.secondsRemaining}s` : 'Wrong PIN');
  }

  return <PinEntryForm title="Enter your PIN" error={error} onComplete={(pin) => void handleComplete(pin)} />;
}
