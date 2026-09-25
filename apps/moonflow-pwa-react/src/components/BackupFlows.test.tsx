import 'fake-indexeddb/auto';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as shareFile from '../lib/share-file';
import { encryptBackup } from '../lib/backup-crypto';
import { buildExportPayload } from '../lib/export';
import { SETTINGS_DEFAULTS } from '../lib/db';
import type { Entry } from '../lib/types';
import { renderRouted } from '../test/render-with-router';
import { StateProvider } from '../state/store';
import { SettingsScreen } from '../screens/Settings';

const ENTRY: Entry = { date: '2026-09-01', flow: 'medium', symptoms: [], mood: null, note: 'private note', updatedAt: 1 };

async function renderSettings() {
  return renderRouted(<SettingsScreen />, {
    wrapper: (children) => (
      <StateProvider testState={{ entries: [ENTRY], settings: { ...SETTINGS_DEFAULTS, onboardingComplete: true, lastPeriodStart: '2026-09-01' } }}>
        {children}
      </StateProvider>
    ),
  });
}

function captureShare() {
  const files: File[] = [];
  vi.spyOn(shareFile, 'shareOrDownload').mockImplementation(async (file) => {
    files.push(file);
    return 'shared';
  });
  return files;
}

describe('export', () => {
  afterEach(() => vi.restoreAllMocks());

  it('encrypted backup (the default) needs a confirmed passphrase and contains no plaintext', async () => {
    const files = captureShare();
    await renderSettings();
    fireEvent.click(screen.getByRole('button', { name: /^Export data/ }));
    fireEvent.change(await screen.findByLabelText('Passphrase'), { target: { value: 'long enough pass' } });
    fireEvent.change(screen.getByLabelText('Confirm passphrase'), { target: { value: 'long enough pass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Export encrypted backup' }));
    await waitFor(() => expect(files).toHaveLength(1), { timeout: 5000 });
    expect(files[0]!.name).toMatch(/\.encrypted\.json$/);
    const text = await files[0]!.text();
    expect(text).not.toContain('private note');
    expect(text).toContain('moonflow-encrypted-backup');
  });

  it('refuses a short or mismatched passphrase', async () => {
    const files = captureShare();
    await renderSettings();
    fireEvent.click(screen.getByRole('button', { name: /^Export data/ }));
    fireEvent.change(await screen.findByLabelText('Passphrase'), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText('Confirm passphrase'), { target: { value: 'short' } });
    expect(screen.getByRole('button', { name: 'Export encrypted backup' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Passphrase'), { target: { value: 'long enough pass' } });
    fireEvent.change(screen.getByLabelText('Confirm passphrase'), { target: { value: 'long enough pasz' } });
    expect(screen.getByText("Passphrases don't match")).toBeInTheDocument();
    expect(files).toHaveLength(0);
  });

  it('offers a readable CSV copy', async () => {
    const files = captureShare();
    await renderSettings();
    fireEvent.click(screen.getByRole('button', { name: /^Export data/ }));
    fireEvent.click(await screen.findByRole('button', { name: /spreadsheet \(csv\)/i }));
    await waitFor(() => expect(files).toHaveLength(1));
    expect(files[0]!.name).toMatch(/\.csv$/);
    expect(await files[0]!.text()).toMatch(/^Date,Flow/);
  });

  it('unencrypted JSON is available but clearly warned about', async () => {
    const files = captureShare();
    await renderSettings();
    fireEvent.click(screen.getByRole('button', { name: /^Export data/ }));
    expect(await screen.findByText(/anyone who gets the file can read it/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /unencrypted/i }));
    await waitFor(() => expect(files).toHaveLength(1));
    expect(await files[0]!.text()).toContain('private note');
  });
});

describe('import of an encrypted backup', () => {
  it('asks for the passphrase, rejects a wrong one, then offers the import', async () => {
    await renderSettings();
    const sealed = await encryptBackup(buildExportPayload([ENTRY], SETTINGS_DEFAULTS, '2026-09-25T00:00:00Z'), 'long enough pass', 1000);
    const input = screen.getByLabelText('Import data file');
    fireEvent.change(input, { target: { files: [new File([sealed], 'b.encrypted.json', { type: 'application/json' })] } });
    fireEvent.change(await screen.findByLabelText('Backup passphrase'), { target: { value: 'nope nope' } });
    fireEvent.click(screen.getByRole('button', { name: 'Unlock backup' }));
    expect(await screen.findByText('Wrong passphrase.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Backup passphrase'), { target: { value: 'long enough pass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Unlock backup' }));
    expect(await screen.findByText(/Import 1 logged day/)).toBeInTheDocument();
  });
});

describe('backup bookkeeping', () => {
  afterEach(() => vi.restoreAllMocks());

  it('records when a backup was made and shows it in Settings', async () => {
    captureShare();
    await renderSettings();
    expect(screen.getByText('Never backed up')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Export data/ }));
    fireEvent.click(await screen.findByRole('button', { name: /spreadsheet \(csv\)/i }));
    expect(await screen.findByText('Backed up today')).toBeInTheDocument();
  });

  it('warns that deleting the icon deletes the data', async () => {
    await renderSettings();
    fireEvent.click(screen.getByRole('button', { name: /moving data to another device/i }));
    expect(await screen.findByText(/removing the app from your home screen deletes everything/i)).toBeInTheDocument();
  });
});
