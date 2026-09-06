// Ported 1:1 from tests/pin-auth-tests.html — same 8 assertions.
import { describe, expect, it } from 'vitest';
import { PIN_LOCKOUT_AFTER_ATTEMPTS, PIN_LOCKOUT_SECONDS } from './constants';
import { evaluatePinAttempt, hashPin, needsUnlock } from './pin-auth';
import { SETTINGS_DEFAULTS } from './db';

describe('hashPin', () => {
  it('matches the known SHA-256 hex digest for "1234"', async () => {
    const hash = await hashPin('1234');
    expect(hash).toBe('03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4');
  });

  it('is deterministic for the same input', async () => {
    const a = await hashPin('9999');
    const b = await hashPin('9999');
    expect(a).toBe(b);
  });

  it('differs for different inputs', async () => {
    const a = await hashPin('0000');
    const b = await hashPin('9999');
    expect(a).not.toBe(b);
  });
});

describe('evaluatePinAttempt', () => {
  it('correct PIN unlocks and clears attempts + lockout', () => {
    const result = evaluatePinAttempt({
      enteredHash: 'abc',
      storedHash: 'abc',
      failedAttempts: 3,
      lockoutUntil: null,
      now: 1000,
    });
    expect(result.ok).toBe(true);
    expect(result.locked).toBe(false);
    expect(result.patch).toEqual({ pinFailedAttempts: 0, pinLockoutUntil: null });
  });

  it('wrong PIN below the lockout threshold just increments attempts', () => {
    const result = evaluatePinAttempt({
      enteredHash: 'wrong',
      storedHash: 'abc',
      failedAttempts: 2,
      lockoutUntil: null,
      now: 1000,
    });
    expect(result.ok).toBe(false);
    expect(result.locked).toBe(false);
    expect(result.patch).toEqual({ pinFailedAttempts: 3, pinLockoutUntil: null });
  });

  it(`the ${PIN_LOCKOUT_AFTER_ATTEMPTS}th wrong PIN triggers a lockout and resets the counter`, () => {
    const result = evaluatePinAttempt({
      enteredHash: 'wrong',
      storedHash: 'abc',
      failedAttempts: PIN_LOCKOUT_AFTER_ATTEMPTS - 1,
      lockoutUntil: null,
      now: 1000,
    });
    expect(result.ok).toBe(false);
    expect(result.locked).toBe(true);
    expect(result.secondsRemaining).toBe(PIN_LOCKOUT_SECONDS);
    expect(result.patch).toEqual({ pinFailedAttempts: 0, pinLockoutUntil: 1000 + PIN_LOCKOUT_SECONDS * 1000 });
  });

  it('an attempt made while still locked out is rejected without touching the hash', () => {
    const result = evaluatePinAttempt({
      enteredHash: 'abc', // even the CORRECT hash must be rejected while locked
      storedHash: 'abc',
      failedAttempts: 0,
      lockoutUntil: 5000,
      now: 4000,
    });
    expect(result.ok).toBe(false);
    expect(result.locked).toBe(true);
    expect(result.secondsRemaining).toBe(1);
    expect(result.patch).toBeNull();
  });

  it('lockout that has just expired is treated as not locked', () => {
    const result = evaluatePinAttempt({
      enteredHash: 'abc',
      storedHash: 'abc',
      failedAttempts: 0,
      lockoutUntil: 5000,
      now: 5000,
    });
    expect(result.ok).toBe(true);
    expect(result.locked).toBe(false);
  });
});

describe('needsUnlock', () => {
  it('is true only when onboarded, the feature is enabled, and a hash is stored', () => {
    expect(
      needsUnlock({ ...SETTINGS_DEFAULTS, onboardingComplete: true, pinLockEnabled: true, pinHash: 'abc' }),
    ).toBe(true);
  });

  it('is false when onboarding is incomplete even if a PIN is configured', () => {
    expect(
      needsUnlock({ ...SETTINGS_DEFAULTS, onboardingComplete: false, pinLockEnabled: true, pinHash: 'abc' }),
    ).toBe(false);
  });

  it('is false when the feature is disabled', () => {
    expect(
      needsUnlock({ ...SETTINGS_DEFAULTS, onboardingComplete: true, pinLockEnabled: false, pinHash: 'abc' }),
    ).toBe(false);
  });

  it('is false when no PIN hash is stored', () => {
    expect(
      needsUnlock({ ...SETTINGS_DEFAULTS, onboardingComplete: true, pinLockEnabled: true, pinHash: null }),
    ).toBe(false);
  });
});
