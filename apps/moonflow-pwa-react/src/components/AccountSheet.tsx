// src/components/AccountSheet.tsx — T98: the optional account (ADR-053).
// Signing up first shows, in plain words, what goes to the server and who can
// read it, and needs that acknowledged. Signing out or deleting the account
// never touches the data on this phone.
import { useState, useSyncExternalStore, type FormEvent } from 'react';
import { MIN_PASSWORD_LENGTH, deleteAccount, signIn, signUp } from '../lib/account';
import { beginSession, endSession, getSyncStatus, mergePreview, subscribeSyncStatus } from '../lib/sync';
import { syncLabel } from '../lib/sync-label';
import { requestSync } from '../lib/sync-trigger';
import { disablePush } from '../lib/push';
import { useMinuteClock } from '../hooks/useMinuteClock';
import type { AccountSession } from '../lib/types';
import { Alert, AlertDescription } from './ui/alert';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { Button } from './ui/button';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from './ui/drawer';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';

type Mode = 'intro' | 'sign-up' | 'sign-in' | 'confirm-merge';

interface PendingMerge {
  session: AccountSession;
  counts: { local: number; remote: number; otherAccount: boolean } | null;
}

export function AccountSheet({
  open,
  onOpenChange,
  account,
  onSessionChange,
  signInOnly = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: AccountSession | null;
  /** Onboarding's "Sign in to restore": straight to the sign-in form. */
  signInOnly?: boolean;
  /** Persist the new session (or null when signed out); false if saving failed. */
  onSessionChange: (session: AccountSession | null) => Promise<boolean>;
}) {
  const startMode: Mode = signInOnly ? 'sign-in' : 'intro';
  const [mode, setMode] = useState<Mode>(startMode);
  const [understood, setUnderstood] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [pending, setPending] = useState<PendingMerge | null>(null);
  const status = useSyncExternalStore(subscribeSyncStatus, getSyncStatus);
  const now = useMinuteClock();
  const expired = account !== null && status.state === 'expired';

  function reset() {
    setMode(startMode);
    setPending(null);
    setPassword('');
    setConfirm('');
    setError(null);
    setBusy(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  const mismatch = mode === 'sign-up' && confirm.length > 0 && password !== confirm;
  const canSubmit =
    !busy &&
    email.trim().length > 0 &&
    (mode === 'sign-in' ? password.length > 0 : password.length >= MIN_PASSWORD_LENGTH && password === confirm && understood);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const result = mode === 'sign-up' ? await signUp(email, password) : await signIn(email, password);
    if (!result.ok) {
      setError(result.error);
      setBusy(false);
      return;
    }
    // Signing back in to the same account after the session expired: just
    // carry on. Anything else is a first sync for this phone, which merges —
    // confirmed first when both sides have days (ADR-054).
    if (account?.userId === result.session.userId) return finish(result.session);
    const counts = await mergePreview(result.session);
    // Nothing to combine — unless this phone's days belong to another
    // account, which would copy them in without asking.
    if (counts && (counts.local === 0 || (counts.remote === 0 && !counts.otherAccount))) return finish(result.session);
    setPending({ session: result.session, counts });
    setMode('confirm-merge');
    setBusy(false);
  }

  async function finish(session: AccountSession) {
    setBusy(true);
    await beginSession(session);
    if (!(await onSessionChange(session))) {
      setError('Signed in, but couldn’t save that on this phone. Try again.');
      setBusy(false);
      return;
    }
    reset();
    requestSync();
  }

  async function handleSignOut() {
    // Reminders belong to the account: stop them on this device first.
    await disablePush(account);
    await endSession();
    if (await onSessionChange(null)) reset();
    else setError('Couldn’t sign out. Try again.');
  }

  async function handleDelete() {
    if (!account) return;
    setBusy(true);
    const result = await deleteAccount(account);
    setBusy(false);
    setDeleteOpen(false);
    setDeleteConfirm('');
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await handleSignOut();
  }

  const days = (count: number) => `${count} ${count === 1 ? 'day' : 'days'}`;

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="mx-auto max-w-[26rem] px-4 pb-5">
        <DrawerHeader className="px-0">
          <DrawerTitle>Account</DrawerTitle>
          <DrawerDescription>
            {signInOnly
              ? 'Sign in to bring the logs and settings synced to your account onto this phone.'
              : account && mode !== 'sign-in'
              ? `Signed in as ${account.email}.`
              : 'Optional. Sign in to keep your logs in step across your devices. Without an account, everything stays on this phone.'}
          </DrawerDescription>
        </DrawerHeader>

        {error && (
          <Alert className="mb-3">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {mode === 'confirm-merge' && pending ? (
          <div className="flex flex-col gap-2">
            <p className="mb-2 text-sm text-foreground">
              {pending.counts?.otherAccount
                ? `This phone's ${days(pending.counts.local)} were synced with a different account. Combining copies them into this one too (it has ${days(pending.counts.remote)}).`
                : pending.counts
                  ? `This phone has ${days(pending.counts.local)} and your account has ${days(pending.counts.remote)}. They'll be combined.`
                  : "This phone and your account may both have days logged. They'll be combined."}{' '}
              Where both have the same day, the more recently saved one is kept.
            </p>
            <Button disabled={busy} onClick={() => void finish(pending.session)} className="h-11 w-full text-sm">
              {busy ? 'Please wait…' : 'Combine and sync'}
            </Button>
            <Button variant="outline" onClick={reset} className="h-11 w-full text-sm">
              Cancel
            </Button>
          </div>
        ) : account && mode !== 'sign-in' ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-foreground" role="status">
              {syncLabel(status, now)}
            </p>
            {expired ? (
              <Button
                onClick={() => {
                  setEmail(account.email);
                  setMode('sign-in');
                }}
                className="h-11 w-full text-sm"
              >
                Sign in again
              </Button>
            ) : (
              <Button variant="outline" disabled={status.state === 'syncing'} onClick={requestSync} className="h-11 w-full text-sm">
                Sync now
              </Button>
            )}
            <p className="my-2 text-xs text-muted-foreground">
              Signing out or deleting the account leaves everything on this phone as it is.
            </p>
            <Button variant="outline" onClick={() => void handleSignOut()} className="h-11 w-full text-sm">
              Sign out
            </Button>
            <Button variant="ghost" onClick={() => setDeleteOpen(true)} className="h-11 w-full text-sm text-destructive">
              Delete account
            </Button>
          </div>
        ) : mode === 'intro' ? (
          <div className="flex flex-col gap-2">
            <Disclosure />
            <Button onClick={() => setMode('sign-up')} className="h-11 w-full text-sm">
              Create account
            </Button>
            <Button variant="outline" onClick={() => setMode('sign-in')} className="h-11 w-full text-sm">
              I already have an account
            </Button>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-2" noValidate>
            <Label htmlFor="account-email" className="text-sm">
              Email
            </Label>
            <Input
              id="account-email"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11"
            />
            <Label htmlFor="account-password" className="text-sm">
              Password
            </Label>
            <Input
              id="account-password"
              type="password"
              autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11"
            />
            {mode === 'sign-up' && (
              <>
                <Label htmlFor="account-password-confirm" className="text-sm">
                  Confirm password
                </Label>
                <Input
                  id="account-password-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  aria-invalid={mismatch || undefined}
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">
                  At least {MIN_PASSWORD_LENGTH} characters. There's no email reset: if you forget it, the app's owner can
                  reset it for you.
                </p>
                {mismatch && (
                  <Alert>
                    <AlertDescription>Passwords don't match</AlertDescription>
                  </Alert>
                )}
                <div className="my-1 flex items-start justify-between gap-3">
                  <Label htmlFor="account-understood" className="text-sm leading-snug">
                    I understand my logs are stored on the server unencrypted, where the server's admin can read them
                  </Label>
                  <Switch id="account-understood" checked={understood} onCheckedChange={setUnderstood} />
                </div>
              </>
            )}
            <Button type="submit" disabled={!canSubmit} className="mt-1 h-11 w-full text-sm">
              {busy ? 'Please wait…' : mode === 'sign-up' ? 'Create account' : 'Sign in'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => (signInOnly ? handleOpenChange(false) : setMode('intro'))} className="h-11 w-full text-sm">
              {signInOnly ? 'Cancel' : 'Back'}
            </Button>
          </form>
        )}
      </DrawerContent>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(next) => {
          setDeleteOpen(next);
          if (!next) setDeleteConfirm('');
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes your account and everything stored on the server. It can't be undone. Your logs on this phone
              stay.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Label htmlFor="delete-account-confirm" className="text-sm">
            Type DELETE to confirm
          </Label>
          <Input
            id="delete-account-confirm"
            autoCapitalize="characters"
            autoComplete="off"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            className="h-11"
          />
          <AlertDialogFooter>
            <Button
              variant="destructive"
              disabled={busy || deleteConfirm.trim().toUpperCase() !== 'DELETE'}
              onClick={() => void handleDelete()}
              className="h-11 w-full text-sm"
            >
              {busy ? 'Deleting…' : 'Delete account'}
            </Button>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Drawer>
  );
}

/** What an account means, before anyone makes one (ADR-053). */
function Disclosure() {
  return (
    <div className="mb-2 rounded-md bg-muted/50 p-3">
      <p className="mb-1.5 text-sm font-medium text-foreground">What an account means</p>
      <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
        <li>Your logs and cycle settings are copied to Moonflow's server, so your other devices can get them.</li>
        <li>
          They're stored unencrypted. The server's admin and the hosting provider can read them, and so could anyone who
          breaks in.
        </li>
        <li>Your PIN, theme and other settings for this phone never leave it.</li>
        <li>There's no email. A forgotten password is reset by the app's owner.</li>
        <li>Delete the account any time to remove everything from the server.</li>
        <li>If you use a duress PIN: anyone who gets your account password can see your synced logs.</li>
      </ul>
    </div>
  );
}
