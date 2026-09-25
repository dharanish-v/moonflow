// src/lib/export.ts — pure payload construction for Settings → Export (T21).
// Kept separate from the actual navigator.share()/download glue so the
// payload shape stays unit-testable without a DOM or a real Share Sheet.
//
// Only the cycle *data* is exported (T33) — never device-specific settings.
// pinHash in particular is a hash of a 4-digit PIN: anyone holding the file
// could reverse it instantly, and export files travel (WhatsApp, iCloud Drive).

import type { Entry, Settings } from './types';

/** Bumped only when the file shape changes; import.ts accepts every version ≤ this. */
export const EXPORT_SCHEMA_VERSION = 1;

export function buildExportPayload(entries: Entry[], settings: Settings, exportedAtIso: string): string {
  const { lastPeriodStart, avgCycleLength, avgPeriodLength } = settings;
  return JSON.stringify(
    {
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportedAt: exportedAtIso,
      settings: { lastPeriodStart, avgCycleLength, avgPeriodLength },
      entries,
    },
    null,
    2,
  );
}

export type ExportKind = 'json' | 'encrypted' | 'csv';

/** @param dateStr "YYYY-MM-DD" · @param discreet true in the "Planner" install (ADR-011) */
export function exportFilename(dateStr: string, discreet: boolean, kind: ExportKind = 'json'): string {
  const base = discreet ? 'planner' : 'moonflow';
  if (kind === 'csv') return `${base}-log-${dateStr}.csv`;
  if (kind === 'encrypted') return `${base}-backup-${dateStr}.encrypted.json`;
  return discreet ? `planner-backup-${dateStr}.json` : `moonflow-export-${dateStr}.json`;
}

export function exportShareTitle(discreet: boolean): string {
  return discreet ? 'Planner backup' : 'Moonflow export';
}
