// src/screens/PinVerify.tsx — "confirm your current PIN" before turning the
// lock off or changing the PIN (T34). Without it, anyone holding the
// unlocked phone could switch the lock off for good.
import { useNavigate, useSearch } from '@tanstack/react-router';
import { PinEntryForm } from '../components/PinEntryForm';
import { usePinAttempt } from '../hooks/usePinAttempt';
import { useSaveSettings } from '../state/useSaveSettings';

export function PinVerifyScreen() {
  const navigate = useNavigate();
  const { intent } = useSearch({ from: '/settings/pin-verify' });
  const { attempt, error } = usePinAttempt();
  const saveSettingsPatch = useSaveSettings();

  async function handleComplete(pin: string) {
    if (!(await attempt(pin))) return;
    if (intent === 'change') {
      navigate({ to: '/settings/pin-setup', replace: true });
      return;
    }
    await saveSettingsPatch({ pinLockEnabled: false });
    navigate({ to: '/settings', replace: true });
  }

  return (
    <PinEntryForm
      title="Enter your current PIN"
      error={error}
      onComplete={(pin) => void handleComplete(pin)}
      onCancel={() => navigate({ to: '/settings', replace: true })}
    />
  );
}
