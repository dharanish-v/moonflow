// src/components/ImportBackup.tsx — the whole "bring a backup in" flow, shared
// by Settings and onboarding (T60): pick a file → (passphrase, if it's an
// encrypted backup) → confirm what will be imported → write → re-read.
// Render-prop trigger so each screen supplies its own button.
import { type ChangeEvent, type ReactNode, useState } from 'react';
import { decryptBackup, isEncryptedBackup } from '../lib/backup-crypto';
import { importData, loadAllEntries, loadAllSettings } from '../lib/db';
import { type ImportPayload, parseImportPayload } from '../lib/import';
import { useAppDispatch } from '../state/hooks';
import { Alert, AlertDescription } from './ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

type Pending = { payload: ImportPayload; skippedEntries: number };

function summarize({ payload, skippedEntries }: Pending): string {
  const n = payload.entries.length;
  const dayPart = n > 0 ? `${n} logged day${n === 1 ? '' : 's'} and your cycle settings` : 'your cycle settings (no logged days were found in this file)';
  const overwriteNote = n > 0 ? ' Entries already logged on the same date here will be overwritten.' : '';
  const skippedNote =
    skippedEntries > 0
      ? ` ${skippedEntries} entr${skippedEntries === 1 ? 'y' : 'ies'} in the file couldn't be read and ${skippedEntries === 1 ? 'was' : 'were'} skipped.`
      : '';
  return `Import ${dayPart}?${overwriteNote}${skippedNote}`;
}

export function ImportBackup({ children }: { children: (pick: () => void) => ReactNode }) {
  const dispatch = useAppDispatch();
  // Held in state (a callback ref), not useRef, so the render-prop trigger
  // never reads a ref during render.
  const [input, setInput] = useState<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  function pick() {
    input?.click();
  }

  function stage(json: string) {
    const result = parseImportPayload(json);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPending({ payload: result.payload, skippedEntries: result.skippedEntries });
  }

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file to retry
    if (!file) return;
    setError(null);
    file
      .text()
      .then((text) => (isEncryptedBackup(text) ? setLocked(text) : stage(text)))
      .catch(() => setError("Couldn't read that file."));
  }

  async function unlock() {
    if (!locked) return;
    setUnlockError(null);
    const result = await decryptBackup(locked, passphrase);
    if (!result.ok) {
      setUnlockError(result.error);
      return;
    }
    setLocked(null);
    setPassphrase('');
    stage(result.json);
  }

  async function confirm() {
    if (!pending) return;
    const ok = await importData(pending.payload.entries, pending.payload.settings);
    setPending(null);
    if (!ok) {
      setError("Couldn't import — try again");
      return;
    }
    try {
      const [entries, settings] = await Promise.all([loadAllEntries(), loadAllSettings()]);
      dispatch({ type: 'BOOT_LOADED', entries, settings });
    } catch {
      // The import itself committed; only the re-read failed. A reload re-reads it.
      setError('Imported — reopen the app to see it.');
    }
  }

  return (
    <>
      {children(pick)}
      <input
        ref={setInput}
        type="file"
        accept="application/json,.json"
        aria-label="Import data file"
        className="hidden"
        onChange={onFile}
      />
      {error && (
        <Alert className="mt-3.5">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <AlertDialog
        open={locked !== null}
        onOpenChange={(open) => {
          if (!open) {
            setLocked(null);
            setPassphrase('');
            setUnlockError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encrypted backup</AlertDialogTitle>
            <AlertDialogDescription>Enter the passphrase this backup was exported with.</AlertDialogDescription>
          </AlertDialogHeader>
          <Label htmlFor="backup-passphrase" className="sr-only">
            Backup passphrase
          </Label>
          <Input
            id="backup-passphrase"
            type="password"
            autoComplete="current-password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            className="h-11"
          />
          {unlockError && (
            <Alert>
              <AlertDescription>{unlockError}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <Button onClick={() => void unlock()} className="h-11 w-full text-sm">
              Unlock backup
            </Button>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pending !== null} onOpenChange={(open) => { if (!open) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import data?</AlertDialogTitle>
            <AlertDialogDescription>{pending ? summarize(pending) : ''}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => void confirm()}>Import</AlertDialogAction>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
