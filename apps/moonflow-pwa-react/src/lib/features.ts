// src/lib/features.ts — build-time switches. Accounts (T98) stay off in
// production builds until sync (T99) lands; turn on with VITE_ACCOUNTS=1.
// A function, not a constant, so tests can flip it with vi.stubEnv.
export function accountsEnabled(): boolean {
  return import.meta.env.VITE_ACCOUNTS === '1';
}
