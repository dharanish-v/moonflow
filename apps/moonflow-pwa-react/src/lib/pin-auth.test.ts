import { describe, expect, it } from 'vitest';
import { PIN_LOCKOUT_AFTER_ATTEMPTS, PIN_LOCKOUT_SECONDS } from './constants';
import { PIN_HASH_ITERATIONS, evaluatePinAttempt, hashPin, needsUnlock, verifyPin } from './pin-auth';
import { SETTINGS_DEFAULTS } from './db';

// SHA-256("1234") — the legacy (pre-T34) stored format.
const LEGACY_1234 = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';
const FAST = 1000; // test-only iteration count; production uses PIN_HASH_ITERATIONS

describe('hashPin / verifyPin', () => {
  it('produces a salted PBKDF2 record, never a bare digest', async () => {
    const stored = await hashPin('1234', FAST);
    expect(stored).toMatch(/^pbkdf2-sha256\$1000\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(stored).not.toContain(LEGACY_1234);
  });

  it('salts: the same PIN hashes differently each time', async () => {
    expect(await hashPin('1234', FAST)).not.toBe(await hashPin('1234', FAST));
  });

  it('verifies the right PIN and rejects a wrong one', async () => {
    const stored = await hashPin('1234', FAST);
    expect(await verifyPin('1234', stored, FAST)).toEqual({ ok: true, needsUpgrade: false });
    expect((await verifyPin('0000', stored, FAST)).ok).toBe(false);
  });

  it('still accepts a legacy SHA-256 hash, flagged for upgrade', async () => {
    expect(await verifyPin('1234', LEGACY_1234)).toEqual({ ok: true, needsUpgrade: true });
    expect((await verifyPin('0000', LEGACY_1234)).ok).toBe(false);
  });

  it('flags a record hashed with fewer iterations than production for upgrade', async () => {
    const stored = await hashPin('1234', FAST);
    expect((await verifyPin('1234', stored, PIN_HASH_ITERATIONS)).needsUpgrade).toBe(true);
  });

  it('rejects a malformed stored value', async () => {
    expect((await verifyPin('1234', 'garbage')).ok).toBe(false);
  });
});

describe('evaluatePinAttempt', () => {
  it('correct PIN unlocks and clears attempts + lockout', () => {
    const result = evaluatePinAttempt({
      matches: true,
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
      matches: false,
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
      matches: false,
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
      matches: true, // even the CORRECT PIN must be rejected while locked
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
      matches: true,
      failedAttempts: 0,
      lockoutUntil: 5000,
      now: 5000,
    });
    expect(result.ok).toBe(true);
    expect(result.locked).toBe(false);
  });
});

describe('evaluatePinAttempt — clock rollback', () => {
  it('never locks out longer than the lockout period, even if the clock was set back', () => {
    const result = evaluatePinAttempt({
      matches: false,
      failedAttempts: 0,
      lockoutUntil: 10_000_000, // written before the clock jumped back hours
      now: 1000,
    });
    expect(result.locked).toBe(true);
    expect(result.secondsRemaining).toBe(PIN_LOCKOUT_SECONDS);
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
