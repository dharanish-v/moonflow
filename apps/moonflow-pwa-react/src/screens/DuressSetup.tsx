// src/screens/DuressSetup.tsx — set the duress PIN (T48): a second PIN that,
// on the lock screen, opens an empty decoy instead of the real data — for
// when someone forces you to unlock. Must differ from the real PIN.
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { PinEntryForm } from '../components/PinEntryForm';
import { hashPin, verifyPin } from '../lib/pin-auth';
import { useAppState } from '../state/hooks';
import { useSaveSettings } from '../state/useSaveSettings';

export function DuressSetupScreen() {
  const navigate = useNavigate();
  const { settings } = useAppState();
  const saveSettingsPatch = useSaveSettings();
  const [firstPin, setFirstPin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleComplete(pin: string) {
    if (firstPin === null) {
      if (settings.pinHash && (await verifyPin(pin, settings.pinHash)).ok) {
        setError('Must be different from your real PIN');
        return;
      }
      setFirstPin(pin);
      setError(null);
      return;
    }
    if (pin !== firstPin) {
      setFirstPin(null);
      setError("PINs didn't match — try again");
      return;
    }
    const ok = await saveSettingsPatch({ duressPinHash: await hashPin(pin) });
    if (!ok) {
      setFirstPin(null);
      setError("Couldn't save — try again");
      return;
    }
    navigate({ to: '/settings', replace: true });
  }

  return (
    <PinEntryForm
      title={firstPin === null ? 'Set a duress PIN' : 'Confirm duress PIN'}
      error={error}
      onComplete={(pin) => void handleComplete(pin)}
      onCancel={() => navigate({ to: '/settings', replace: true })}
    />
  );
}
