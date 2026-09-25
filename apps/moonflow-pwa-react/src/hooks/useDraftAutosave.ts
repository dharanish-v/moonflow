// src/hooks/useDraftAutosave.ts — T20 draft autosave: persists the
// in-progress log-entry snapshot on backgrounding (Page Visibility API), not
// on every keystroke (data-safety edge-case rules).
//
// The draft goes into the store as well as IndexedDB (T40): an auto-relock
// after 2 minutes backgrounded unmounts LogEntry, and on unlock it remounts
// from state.settings.draftEntry — writing only to the DB left that stale, so
// the half-typed note vanished (and closing the sheet then erased the DB copy).
import { useCallback, useEffect, useRef } from 'react';
import type { LogEntryInput } from '../lib/types';
import { useSaveSettings } from '../state/useSaveSettings';

export function useDraftAutosave() {
  const draftRef = useRef<LogEntryInput | null>(null);
  const saveSettingsPatch = useSaveSettings();

  useEffect(() => {
    function onVisibilityChange() {
      if (!document.hidden) return;
      const draft = draftRef.current;
      if (draft) void saveSettingsPatch({ draftEntry: draft });
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [saveSettingsPatch]);

  const reportDraft = useCallback((draft: LogEntryInput) => {
    draftRef.current = draft;
  }, []);
  const clearDraft = useCallback(() => {
    draftRef.current = null;
  }, []);

  return { reportDraft, clearDraft };
}
