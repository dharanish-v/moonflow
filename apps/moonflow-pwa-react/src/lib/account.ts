// src/lib/account.ts — T98. Optional account on the Moonflow backend
// (PocketBase on PocketHost, ADR-053): sign up, sign in, refresh, delete.
// Plain fetch, no SDK — four endpoints don't justify a dependency that would
// need updating for years.
import { backendBase } from './backend';
import type { AccountSession } from './types';

export const MIN_PASSWORD_LENGTH = 10;

export type AccountResult = { ok: true; session: AccountSession } | { ok: false; error: string };

const OFFLINE = "Can't reach the server. Check your connection and try again.";

interface PocketBaseError {
  message?: string;
  data?: Record<string, { code?: string }>;
}

async function call(path: string, init: RequestInit): Promise<{ status: number; body: unknown } | null> {
  try {
    const res = await fetch(`${backendBase()}/api/collections/users${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...init.headers },
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  } catch {
    return null;
  }
}

function toSession(body: unknown): AccountSession {
  const { token, record } = body as { token: string; record: { id: string; email: string } };
  return { userId: record.id, email: record.email, token };
}

export async function signIn(email: string, password: string): Promise<AccountResult> {
  const res = await call('/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: email.trim(), password }),
  });
  if (!res) return { ok: false, error: OFFLINE };
  if (res.status === 200) return { ok: true, session: toSession(res.body) };
  if (res.status === 429) return { ok: false, error: 'Too many attempts. Wait a moment and try again.' };
  return { ok: false, error: 'That email and password don’t match an account.' };
}

export async function signUp(email: string, password: string): Promise<AccountResult> {
  const res = await call('/records', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim(), password, passwordConfirm: password }),
  });
  if (!res) return { ok: false, error: OFFLINE };
  if (res.status !== 200) {
    const fields = (res.body as PocketBaseError | null)?.data ?? {};
    if (fields.email?.code === 'validation_not_unique') return { ok: false, error: 'An account with this email already exists. Sign in instead.' };
    if (fields.email) return { ok: false, error: 'Enter a valid email address.' };
    if (fields.password) return { ok: false, error: `Use a password of at least ${MIN_PASSWORD_LENGTH} characters.` };
    return { ok: false, error: 'Couldn’t create the account. Try again.' };
  }
  return signIn(email, password);
}

/** Swap a session's token for a fresh one. `expired` means sign in again;
 * `offline` means keep the session and try later. */
export async function refreshSession(session: AccountSession): Promise<
  { ok: true; session: AccountSession } | { ok: false; reason: 'expired' | 'offline' }
> {
  const res = await call('/auth-refresh', { method: 'POST', headers: { authorization: session.token } });
  if (!res) return { ok: false, reason: 'offline' };
  if (res.status === 200) return { ok: true, session: toSession(res.body) };
  return res.status === 401 || res.status === 403 || res.status === 404 ? { ok: false, reason: 'expired' } : { ok: false, reason: 'offline' };
}

/** Deletes the account and, through the schema's cascade, every row synced
 * to the server. Data on this phone is untouched. */
export async function deleteAccount(session: AccountSession): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await call(`/records/${encodeURIComponent(session.userId)}`, {
    method: 'DELETE',
    headers: { authorization: session.token },
  });
  if (!res) return { ok: false, error: OFFLINE };
  if (res.status === 204) return { ok: true };
  if (res.status === 401 || res.status === 403 || res.status === 404) {
    return { ok: false, error: 'Your session has expired. Sign out, sign in again, then delete.' };
  }
  return { ok: false, error: 'Couldn’t delete the account. Try again.' };
}
