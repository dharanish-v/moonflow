// src/lib/pin-auth.ts — PIN hashing (Web Crypto, SHA-256) and the pure
// lockout/attempt decision logic, ported verbatim from pin-auth.js. See the
// security edge-case rules in design-system.md: threat model is someone
// picking up an unlocked phone, not offline brute force, so a hash + a short
// lockout delay is enough — no salt/PBKDF2 needed for a 4-digit code guarded
// by a lockout, not a storage-at-rest attack.

import { PIN_LOCKOUT_AFTER_ATTEMPTS, PIN_LOCKOUT_SECONDS } from './constants';
import type { Settings } from './types';

/** @returns lowercase hex SHA-256 digest */
export async function hashPin(pin: string): Promise<string> {
  const bytes = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface PinAttemptArgs {
  enteredHash: string;
  storedHash: string;
  failedAttempts: number;
  lockoutUntil: number | null;
  now: number;
}

export interface PinAttemptResult {
  ok: boolean;
  locked: boolean;
  secondsRemaining?: number;
  patch: { pinFailedAttempts: number; pinLockoutUntil: number | null } | null;
}

/**
 * Pure decision for one unlock attempt — no I/O, so it's directly
 * unit-testable. The caller does the actual hashPin() call and settings
 * persistence around this.
 */
export function evaluatePinAttempt({
  enteredHash,
  storedHash,
  failedAttempts,
  lockoutUntil,
  now,
}: PinAttemptArgs): PinAttemptResult {
  if (lockoutUntil && now < lockoutUntil) {
    return { ok: false, locked: true, secondsRemaining: Math.ceil((lockoutUntil - now) / 1000), patch: null };
  }

  if (enteredHash === storedHash) {
    return { ok: true, locked: false, patch: { pinFailedAttempts: 0, pinLockoutUntil: null } };
  }

  const attempts = failedAttempts + 1;
  if (attempts >= PIN_LOCKOUT_AFTER_ATTEMPTS) {
    return {
      ok: false,
      locked: true,
      secondsRemaining: PIN_LOCKOUT_SECONDS,
      patch: { pinFailedAttempts: 0, pinLockoutUntil: now + PIN_LOCKOUT_SECONDS * 1000 },
    };
  }

  return { ok: false, locked: false, patch: { pinFailedAttempts: attempts, pinLockoutUntil: null } };
}

/** Is the PIN-lock *feature* both configured and currently gating entry? Distinct from
 * whether the lock screen is presently showing — see AppGate's own isLocked state. */
export function needsUnlock(settings: Pick<Settings, 'onboardingComplete' | 'pinLockEnabled' | 'pinHash'>): boolean {
  return !!(settings.onboardingComplete && settings.pinLockEnabled && settings.pinHash);
}
