// src/lib/backup-nudge.ts — T47. The data lives only on this phone (and dies
// with the home-screen icon), so a backup is the only safety net. Nudge
// gently, never nag: only once there's real history, and only when stale.
import { diffDays, formatDate } from './cycle-math';

const DAY_MS = 86_400_000;
export const BACKUP_STALE_DAYS = 30;
/** Don't nag in the first two weeks — there's little to lose yet. */
const FIRST_NUDGE_AFTER_DAYS = 14;

export function backupNudge({
  lastBackupAt,
  firstEntryDate,
  now,
}: {
  lastBackupAt: number | null;
  firstEntryDate: string | null;
  now: number;
}): string | null {
  if (lastBackupAt === null) {
    if (!firstEntryDate) return null;
    return diffDays(firstEntryDate, formatDate(new Date(now))) >= FIRST_NUDGE_AFTER_DAYS ? "You haven't backed up yet" : null;
  }
  const days = Math.floor((now - lastBackupAt) / DAY_MS);
  return days > BACKUP_STALE_DAYS ? `Last backup was ${days} days ago` : null;
}

export function lastBackupLabel(lastBackupAt: number | null, now: number): string {
  if (lastBackupAt === null) return 'Never backed up';
  const days = diffDays(formatDate(new Date(lastBackupAt)), formatDate(new Date(now)));
  if (days <= 0) return 'Backed up today';
  if (days === 1) return 'Backed up yesterday';
  return `Backed up ${days} days ago`;
}
