// src/screens/PinSetup.tsx — Settings' "enable App lock, no PIN set yet"
// flow (create-1/create-2, entering the PIN twice — QA checklist
// requirement). A real route (/settings/pin-setup), not an inline overlay,
// specifically so the tab bar's route allow-list naturally hides it — same
// as the vanilla app's own SCREENS_WITH_TAB_BAR excluding 'pin-lock'. Never
// touches AppGate.isLocked — this only ever runs while already unlocked.
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { PinEntryForm } from '../components/PinEntryForm';
import { setSetting } from '../lib/db';
import { hashPin } from '../lib/pin-auth';
import { useAppDispatch } from '../state/store';

type Mode = 'create-1' | 'create-2';

export function PinSetupScreen() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('create-1');
  const [firstPinHash, setFirstPinHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleComplete(pin: string) {
    const hash = await hashPin(pin);
    if (mode === 'create-1') {
      setFirstPinHash(hash);
      setMode('create-2');
      setError(null);
      return;
    }
    if (hash === firstPinHash) {
      await setSetting('pinHash', hash);
      await setSetting('pinLockEnabled', true);
      dispatch({ type: 'PATCH_SETTINGS', patch: { pinHash: hash, pinLockEnabled: true } });
      navigate({ to: '/settings', replace: true });
    } else {
      setMode('create-1');
      setFirstPinHash(null);
      setError("PINs didn't match — try again");
    }
  }

  return (
    <PinEntryForm
      title={mode === 'create-2' ? 'Confirm your PIN' : 'Set a PIN'}
      error={error}
      onComplete={(pin) => void handleComplete(pin)}
      onCancel={() => navigate({ to: '/settings', replace: true })}
    />
  );
}
