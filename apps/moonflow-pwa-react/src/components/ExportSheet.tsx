// src/components/ExportSheet.tsx — T46. Three ways out, safest first:
// an encrypted backup (default; re-importable), a plain JSON backup (warned),
// and a readable CSV copy (for a spreadsheet or a doctor; not re-importable).
import { useState } from 'react';
import { buildCsv } from '../lib/csv';
import { encryptBackup } from '../lib/backup-crypto';
import { buildExportPayload, exportFilename, exportShareTitle } from '../lib/export';
import { todayString } from '../lib/cycle-math';
import { isDiscreetInstall } from '../lib/install-identity';
import { shareOrDownload } from '../lib/share-file';
import type { Entry, Settings } from '../lib/types';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from './ui/drawer';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Separator } from './ui/separator';

export const MIN_PASSPHRASE_LENGTH = 8;

export function ExportSheet({
  open,
  onOpenChange,
  entries,
  settings,
  onExported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: Entry[];
  settings: Settings;
  onExported?: () => void;
}) {
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const discreet = isDiscreetInstall();
  const mismatch = confirm.length > 0 && passphrase !== confirm;
  const canEncrypt = passphrase.length >= MIN_PASSPHRASE_LENGTH && passphrase === confirm && !busy;

  async function send(contents: string, kind: 'encrypted' | 'json' | 'csv') {
    const type = kind === 'csv' ? 'text/csv' : 'application/json';
    const file = new File([contents], exportFilename(todayString(), discreet, kind), { type });
    const outcome = await shareOrDownload(file, exportShareTitle(discreet));
    if (outcome !== 'cancelled') {
      onExported?.();
      onOpenChange(false);
    }
  }

  async function handleEncrypted() {
    setBusy(true);
    try {
      const json = buildExportPayload(entries, settings, new Date().toISOString());
      await send(await encryptBackup(json, passphrase), 'encrypted');
      setPassphrase('');
      setConfirm('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-[26rem] px-4 pb-5">
        <DrawerHeader className="px-0">
          <DrawerTitle>Export data</DrawerTitle>
          <DrawerDescription>Your data only exists on this phone — a backup is the only way to keep it safe.</DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="export-passphrase" className="text-sm">
            Passphrase
          </Label>
          <Input
            id="export-passphrase"
            type="password"
            autoComplete="new-password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            className="h-11"
          />
          <Label htmlFor="export-passphrase-confirm" className="text-sm">
            Confirm passphrase
          </Label>
          <Input
            id="export-passphrase-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={mismatch || undefined}
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">
            At least {MIN_PASSPHRASE_LENGTH} characters. There's no way to recover a forgotten passphrase.
          </p>
          {mismatch && (
            <Alert>
              <AlertDescription>Passphrases don't match</AlertDescription>
            </Alert>
          )}
          <Button disabled={!canEncrypt} onClick={() => void handleEncrypted()} className="h-11 w-full text-sm">
            {busy ? 'Encrypting…' : 'Export encrypted backup'}
          </Button>
        </div>

        <Separator className="my-4" />

        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            onClick={() => void send(buildCsv(entries), 'csv')}
            className="h-11 w-full text-sm"
          >
            Spreadsheet (CSV) — readable copy
          </Button>
          <Button
            variant="outline"
            onClick={() => void send(buildExportPayload(entries, settings, new Date().toISOString()), 'json')}
            className="h-11 w-full text-sm"
          >
            Unencrypted backup (JSON)
          </Button>
          <p className="text-xs text-muted-foreground">
            CSV and unencrypted files aren't protected — anyone who gets the file can read it.
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
