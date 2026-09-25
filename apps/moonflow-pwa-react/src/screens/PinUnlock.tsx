// src/screens/PinUnlock.tsx — the security gate's real chrome (unlock mode
// only; see AppGate.tsx for why pin-lock isn't a route).
//
// "Forgot PIN?" is the only recovery path, and it's honest about what it
// costs: the PIN gates the only copy of the data, so the way out is erasing
// it and starting over (restoring from an export afterwards).
import { useState } from 'react';
import { PinEntryForm } from '../components/PinEntryForm';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/alert-dialog';
import { Button } from '../components/ui/button';
import { eraseAllData } from '../lib/db';
import { usePinAttempt } from '../hooks/usePinAttempt';

export function PinUnlockScreen({ onUnlock, onErased }: { onUnlock: () => void; onErased?: () => void }) {
  const { attempt, error } = usePinAttempt();
  const [eraseFailed, setEraseFailed] = useState(false);

  async function handleComplete(pin: string) {
    if (await attempt(pin)) onUnlock();
  }

  async function handleErase() {
    const ok = await eraseAllData();
    if (!ok) {
      setEraseFailed(true);
      return;
    }
    onErased?.();
  }

  return (
    <PinEntryForm
      title="Enter your PIN"
      error={eraseFailed ? "Couldn't erase — try again" : error}
      onComplete={(pin) => void handleComplete(pin)}
      footer={
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" className="h-11 w-full text-sm text-muted-foreground">
              Forgot PIN?
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Erase everything and start over?</AlertDialogTitle>
              <AlertDialogDescription>
                There's no way to recover a forgotten PIN. This permanently erases every log and setting on this device. If
                you exported a backup, you can import it after setting up again.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => void handleErase()}>
                Erase everything
              </AlertDialogAction>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      }
    />
  );
}
