// @ts-check
// pin-auth.js — PIN hashing (Web Crypto, SHA-256) and the pure lockout/attempt
// decision logic for T19. See the security edge-case rules in
// moonflow-design-system.md: threat model is someone picking up an unlocked
// phone, not offline brute force, so a hash + a short lockout delay is enough —
// no salt/PBKDF2 needed for a 4-digit code guarded by a lockout, not storage-at-rest attack.

import { PIN_LOCKOUT_AFTER_ATTEMPTS, PIN_LOCKOUT_SECONDS } from './constants.js';

/**
 * @param {string} pin
 * @returns {Promise<string>} lowercase hex SHA-256 digest
 */
export async function hashPin(pin) {
  const bytes = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Pure decision for one unlock attempt — no I/O, so it's directly unit-testable
 * (see tests/pin-auth-tests.html). The caller (app.js) does the actual
 * hashPin() call and setSetting() persistence around this.
 * @param {{enteredHash: string, storedHash: string, failedAttempts: number, lockoutUntil: number|null, now: number}} args
 * @returns {{ok: boolean, locked: boolean, secondsRemaining?: number, patch: {pinFailedAttempts: number, pinLockoutUntil: number|null}|null}}
 */
export function evaluatePinAttempt({ enteredHash, storedHash, failedAttempts, lockoutUntil, now }) {
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
      patch: { pinFailedAttempts: 0, pinLockoutUntil: now + PIN_LOCKOUT_SECONDS * 1000 }
    };
  }

  return { ok: false, locked: false, patch: { pinFailedAttempts: attempts, pinLockoutUntil: null } };
}
