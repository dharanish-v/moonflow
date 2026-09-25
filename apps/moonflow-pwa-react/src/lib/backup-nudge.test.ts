import { describe, expect, it } from 'vitest';
import { backupNudge, lastBackupLabel } from './backup-nudge';

const DAY = 86_400_000;
const NOW = new Date(2026, 8, 26, 12).getTime();

describe('backupNudge', () => {
  it('stays quiet for a brand-new user with nothing worth backing up yet', () => {
    expect(backupNudge({ lastBackupAt: null, firstEntryDate: null, now: NOW })).toBeNull();
    expect(backupNudge({ lastBackupAt: null, firstEntryDate: '2026-09-20', now: NOW })).toBeNull();
  });

  it('nudges once two weeks of logs exist and nothing was ever backed up', () => {
    expect(backupNudge({ lastBackupAt: null, firstEntryDate: '2026-09-01', now: NOW })).toBe("You haven't backed up yet");
  });

  it('nudges when the last backup is over 30 days old', () => {
    expect(backupNudge({ lastBackupAt: NOW - 43 * DAY, firstEntryDate: '2026-01-01', now: NOW })).toBe('Last backup was 43 days ago');
  });

  it('stays quiet after a recent backup', () => {
    expect(backupNudge({ lastBackupAt: NOW - 5 * DAY, firstEntryDate: '2026-01-01', now: NOW })).toBeNull();
  });
});

describe('lastBackupLabel', () => {
  it('describes the last backup in plain words', () => {
    expect(lastBackupLabel(null, NOW)).toBe('Never backed up');
    expect(lastBackupLabel(NOW - 1000, NOW)).toBe('Backed up today');
    expect(lastBackupLabel(NOW - DAY, NOW)).toBe('Backed up yesterday');
    expect(lastBackupLabel(NOW - 12 * DAY, NOW)).toBe('Backed up 12 days ago');
  });
});
