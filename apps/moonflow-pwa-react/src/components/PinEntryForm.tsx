// src/components/PinEntryForm.tsx — shared chrome for both the security
// gate's unlock screen (PinUnlock.tsx) and Settings' inline PIN-setup flow.
// Native numeric input, not a bespoke keypad — inputMode="numeric" already
// gets the correct iOS keyboard for free. Wrong-PIN shake via framer-motion's
// imperative animate() against the real input node.
import { animate, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { LockIcon } from './icons';

const PIN_LENGTH = 4;

export interface PinEntryFormProps {
  title: string;
  error?: string | null;
  onComplete: (pin: string) => void;
  onCancel?: () => void;
}

export function PinEntryForm({ title, error, onComplete, onCancel }: PinEntryFormProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (error && inputRef.current && !prefersReducedMotion) {
      animate(inputRef.current, { x: [0, 8, -8, 8, -8, 8, -8, 0] }, { duration: 0.42, ease: 'easeInOut' });
    }
  }, [error, prefersReducedMotion]);

  return (
    <div className="mx-auto box-border flex w-full max-w-[26rem] flex-1 flex-col justify-center px-4 py-5">
      <div className="mx-auto mb-3.5 flex size-11 items-center justify-center rounded-full bg-primary/15 text-primary">
        <LockIcon className="size-5" />
      </div>
      <h1 className="mb-1 text-center text-base font-medium text-foreground">{title}</h1>
      <Alert className={`mb-5 justify-center ${error ? '' : 'invisible'}`}>
        <AlertDescription>{error || ' '}</AlertDescription>
      </Alert>

      <div className="mb-5">
        <Label htmlFor="pin-input" className="mb-1.5 block text-xs text-muted-foreground">
          {title}
        </Label>
        <Input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          maxLength={PIN_LENGTH}
          id="pin-input"
          value={value}
          onChange={(e) => {
            const next = e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH);
            setValue(next);
            if (next.length === PIN_LENGTH) {
              setValue('');
              onComplete(next);
            }
          }}
          className="h-11 text-center text-xl tracking-[0.5em]"
        />
      </div>

      {onCancel && (
        <Button variant="ghost" onClick={onCancel} className="h-11 w-full text-sm text-muted-foreground">
          Cancel
        </Button>
      )}
    </div>
  );
}
