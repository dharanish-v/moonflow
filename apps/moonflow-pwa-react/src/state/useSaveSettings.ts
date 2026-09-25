// src/state/useSaveSettings.ts — the one way screens persist settings (T39).
// Writes first (atomically, see db.saveSettings), and only updates the store
// once the write actually landed — a UI that says "saved" for a write that
// failed silently reverts on the next launch.
import { useCallback } from 'react';
import { saveSettings } from '../lib/db';
import type { Settings } from '../lib/types';
import { useAppDispatch } from './store';

export function useSaveSettings() {
  const dispatch = useAppDispatch();
  return useCallback(
    async (patch: Partial<Settings>): Promise<boolean> => {
      const ok = await saveSettings(patch);
      if (ok) dispatch({ type: 'PATCH_SETTINGS', patch });
      return ok;
    },
    [dispatch],
  );
}
