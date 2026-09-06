// src/hooks/useDraftAutosave.ts — T20 draft autosave: persists the
// in-progress log-entry snapshot on backgrounding (Page Visibility API), not
// on every keystroke (data-safety edge-case rules). Local to the screen that
// uses it (a ref, not global Context) — same spirit as the vanilla app's own
// module-local latestLogDraft (ADR-007).
import { useEffect, useRef } from 'react';
import { setSetting } from '../lib/db';
import type { LogEntryInput } from '../lib/types';

export function useDraftAutosave() {
  const draftRef = useRef<LogEntryInput | null>(null);

  useEffect(() => {
    function onVisibilityChange() {
      if (!document.hidden) return;
      const draft = draftRef.current;
      if (draft) void setSetting('draftEntry', draft);
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  return {
    reportDraft: (draft: LogEntryInput) => {
      draftRef.current = draft;
    },
    clearDraft: () => {
      draftRef.current = null;
    },
  };
}
