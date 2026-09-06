// src/lib/export.ts — pure payload construction for Settings → Export (T21).
// Kept separate from the actual navigator.share()/download glue so the
// payload shape stays unit-testable without a DOM or a real Share Sheet.

import type { Entry, Settings } from './types';

export function buildExportPayload(entries: Entry[], settings: Settings, exportedAtIso: string): string {
  return JSON.stringify({ entries, settings, exportedAt: exportedAtIso }, null, 2);
}

/** @param dateStr "YYYY-MM-DD" */
export function exportFilename(dateStr: string): string {
  return `moonflow-export-${dateStr}.json`;
}
