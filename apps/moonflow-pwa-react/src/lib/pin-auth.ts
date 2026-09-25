// src/lib/pin-auth.ts — PIN hashing (Web Crypto PBKDF2) and the pure
// lockout/attempt decision logic.
//
// Threat model (design-system.md): someone picking up an unlocked phone, not
// a storage-at-rest attacker — the PIN gates the UI, it doesn't encrypt data.
// Even so, the stored value shouldn't be trivially reversible: the original
// unsalted SHA-256 of a 4-digit PIN fell to a 10,000-entry lookup table
// instantly (T34). Salted PBKDF2 at 600k iterations makes each guess cost
// real time, and legacy SHA-256 records still verify and get upgraded on the
// next successful unlock.

import { PIN_LOCKOUT_AFTER_ATTEMPTS, PIN_LOCKOUT_SECONDS } from './constants';
import type { Settings } from './types';

/** OWASP 2023 recommendation for PBKDF2-HMAC-SHA256. */
export const PIN_HASH_ITERATIONS = 600_000;
const SCHEME = 'pbkdf2-sha256';
const LEGACY_SHA256_RE = /^[0-9a-f]{64}$/;

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromB64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

async function pbkdf2(pin: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256);
  return new Uint8Array(bits);
}

async function legacySha256(pin: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time-ish comparison — no early exit on the first differing byte. */
function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

/** @returns `pbkdf2-sha256$<iterations>$<salt b64>$<hash b64>` */
export async function hashPin(pin: string, iterations: number = PIN_HASH_ITERATIONS): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(pin, salt, iterations);
  return `${SCHEME}$${iterations}$${toB64(salt)}$${toB64(hash)}`;
}

export interface VerifyResult {
  ok: boolean;
  /** Correct PIN, but stored in a weaker format — re-hash and save it. */
  needsUpgrade: boolean;
}

export async function verifyPin(pin: string, stored: string, targetIterations: number = PIN_HASH_ITERATIONS): Promise<VerifyResult> {
  if (LEGACY_SHA256_RE.test(stored)) {
    const ok = (await legacySha256(pin)) === stored;
    return { ok, needsUpgrade: ok };
  }
  const [scheme, iterStr, saltB64, hashB64] = stored.split('$');
  const iterations = Number(iterStr);
  if (scheme !== SCHEME || !Number.isInteger(iterations) || iterations <= 0 || !saltB64 || !hashB64) {
    return { ok: false, needsUpgrade: false };
  }
  try {
    const ok = equalBytes(await pbkdf2(pin, fromB64(saltB64), iterations), fromB64(hashB64));
    return { ok, needsUpgrade: ok && iterations < targetIterations };
  } catch {
    return { ok: false, needsUpgrade: false };
  }
}

export interface PinAttemptArgs {
  matches: boolean;
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
 * unit-testable. The caller does the actual verifyPin() call and settings
 * persistence around this.
 */
export function evaluatePinAttempt({ matches, failedAttempts, lockoutUntil, now }: PinAttemptArgs): PinAttemptResult {
  const maxLockoutMs = PIN_LOCKOUT_SECONDS * 1000;
  if (lockoutUntil && now < lockoutUntil) {
    // A lockout further out than one full period means the device clock was
    // set back after it started — cap it instead of locking out for hours.
    if (lockoutUntil - now > maxLockoutMs) {
      return {
        ok: false,
        locked: true,
        secondsRemaining: PIN_LOCKOUT_SECONDS,
        patch: { pinFailedAttempts: failedAttempts, pinLockoutUntil: now + maxLockoutMs },
      };
    }
    return { ok: false, locked: true, secondsRemaining: Math.ceil((lockoutUntil - now) / 1000), patch: null };
  }

  if (matches) {
    return { ok: true, locked: false, patch: { pinFailedAttempts: 0, pinLockoutUntil: null } };
  }

  const attempts = failedAttempts + 1;
  if (attempts >= PIN_LOCKOUT_AFTER_ATTEMPTS) {
    return {
      ok: false,
      locked: true,
      secondsRemaining: PIN_LOCKOUT_SECONDS,
      patch: { pinFailedAttempts: 0, pinLockoutUntil: now + maxLockoutMs },
    };
  }

  return { ok: false, locked: false, patch: { pinFailedAttempts: attempts, pinLockoutUntil: null } };
}

/** Is the PIN-lock *feature* both configured and currently gating entry? Distinct from
 * whether the lock screen is presently showing — see AppGate's own isLocked state. */
export function needsUnlock(settings: Pick<Settings, 'onboardingComplete' | 'pinLockEnabled' | 'pinHash'>): boolean {
  return !!(settings.onboardingComplete && settings.pinLockEnabled && settings.pinHash);
}
