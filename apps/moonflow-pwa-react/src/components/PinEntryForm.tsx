// src/components/PinEntryForm.tsx — shared chrome for the unlock screen, PIN
// setup/verify and duress setup. An on-screen keypad with progress dots, like
// the iOS passcode screen (T61). A labelled input stays for hardware
// keyboards and assistive tech, with inputMode="none" so it doesn't summon
// the iOS keyboard over the keypad. Wrong-PIN shake via framer-motion.
import { animate, useReducedMotion } from 'framer-motion';
import { Delete } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { LockIcon } from './icons';

const PIN_LENGTH = 4;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

export interface PinEntryFormProps {
  title: string;
  error?: string | null;
  onComplete: (pin: string) => void;
  onCancel?: () => void;
  /** Epoch ms while a lockout is running: entry is disabled and a live countdown shows. */
  lockedUntil?: number | null;
  /** A previous entry is still being checked — keypad disabled meanwhile. */
  busy?: boolean;
  /** Extra actions under the form (e.g. the unlock screen's "Forgot PIN?"). */
  footer?: ReactNode;
}

function useSecondsLeft(until: number | null | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until || until <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [until]);
  return until ? Math.max(0, Math.ceil((until - now) / 1000)) : 0;
}

export function PinEntryForm({ title, error, onComplete, onCancel, lockedUntil, busy = false, footer }: PinEntryFormProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dotsRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const secondsLeft = useSecondsLeft(lockedUntil);
  const locked = secondsLeft > 0;
  const disabled = locked || busy;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (error && dotsRef.current && !prefersReducedMotion) {
      animate(dotsRef.current, { x: [0, 8, -8, 8, -8, 8, -8, 0] }, { duration: 0.42, ease: 'easeInOut' });
    }
  }, [error, prefersReducedMotion]);

  function update(next: string) {
    const digits = next.replace(/\D/g, '').slice(0, PIN_LENGTH);
    if (digits.length === PIN_LENGTH) {
      setValue('');
      onComplete(digits);
    } else {
      setValue(digits);
    }
  }

  const message = locked ? `Too many attempts — try again in ${secondsLeft}s` : error;

  return (
    <div className="mx-auto box-border flex w-full max-w-[26rem] flex-1 flex-col justify-center px-4 py-5">
      <div className="mx-auto mb-3.5 flex size-11 items-center justify-center rounded-full bg-primary/15 text-primary">
        <LockIcon className="size-5" />
      </div>
      <h1 className="mb-1 text-center text-base font-medium text-foreground">{title}</h1>
      <Alert role="alert" className={`mb-4 justify-center ${message ? '' : 'invisible'}`}>
        <AlertDescription>{message || ' '}</AlertDescription>
      </Alert>

      <Label htmlFor="pin-input" className="sr-only">
        {title}
      </Label>
      <input
        ref={inputRef}
        id="pin-input"
        type="password"
        inputMode="none"
        pattern="[0-9]*"
        autoComplete="off"
        maxLength={PIN_LENGTH}
        disabled={disabled}
        value={value}
        onChange={(e) => update(e.target.value)}
        className="sr-only"
      />

      <div
        ref={dotsRef}
        role="img"
        aria-label={`${value.length} of ${PIN_LENGTH} digits entered`}
        className="mb-6 flex justify-center gap-4"
        onClick={() => inputRef.current?.focus()}
      >
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span
            key={i}
            className={`size-3.5 rounded-full border-2 border-foreground transition-colors ${i < value.length ? 'bg-foreground' : ''}`}
          />
        ))}
      </div>

      <div className="mx-auto grid w-full max-w-[17rem] grid-cols-3 gap-3">
        {KEYS.map((k, i) =>
          k === '' ? (
            <span key={i} />
          ) : k === 'del' ? (
            <Button
              key={i}
              variant="ghost"
              aria-label="Delete"
              disabled={disabled || value.length === 0}
              onClick={() => update(value.slice(0, -1))}
              className="size-18 justify-self-center rounded-full text-foreground"
            >
              <Delete className="size-6" aria-hidden="true" />
            </Button>
          ) : (
            <Button
              key={i}
              variant="outline"
              disabled={disabled}
              onClick={() => update(value + k)}
              className="size-18 justify-self-center rounded-full text-2xl font-normal"
            >
              {k}
            </Button>
          ),
        )}
      </div>

      {onCancel && (
        <Button variant="ghost" onClick={onCancel} className="mt-4 h-11 w-full text-sm text-muted-foreground">
          Cancel
        </Button>
      )}
      {footer}
    </div>
  );
}
