// @ts-check
// export.js — pure payload construction for Settings → Export data (T21).
// Kept separate from app.js's navigator.share()/download glue (see exportData()
// in app.js) so the actual payload shape is unit-testable without a DOM or a
// real Share Sheet — see tests/export-tests.html.

/**
 * @param {Array<object>} entries
 * @param {Record<string, any>} settings
 * @param {string} exportedAtIso
 */
export function buildExportPayload(entries, settings, exportedAtIso) {
  return JSON.stringify({ entries, settings, exportedAt: exportedAtIso }, null, 2);
}

/** @param {string} dateStr "YYYY-MM-DD" */
export function exportFilename(dateStr) {
  return `moonflow-export-${dateStr}.json`;
}
