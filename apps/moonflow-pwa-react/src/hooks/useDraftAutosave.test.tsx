import 'fake-indexeddb/auto';
import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import { getSetting } from '../lib/db';
import type { LogEntryInput } from '../lib/types';
import type { AppState } from '../state/actions';
import { StateProvider } from '../state/store';
import { StateProbe } from '../test/state-probe';
import { useDraftAutosave } from './useDraftAutosave';

const DRAFT: LogEntryInput = { date: '2026-09-06', flow: 'light', symptoms: [], mood: null, note: 'half-typed' };

function Reporter() {
  const { reportDraft } = useDraftAutosave();
  useEffect(() => reportDraft(DRAFT), [reportDraft]);
  return null;
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('useDraftAutosave', () => {
  it('on backgrounding, saves the draft to IndexedDB *and* the store — so a relock remount restores it', async () => {
    let latest: AppState | null = null;
    render(
      <StateProvider testState={{}}>
        <Reporter />
        <StateProbe onState={(s) => (latest = s)} />
      </StateProvider>,
    );
    await act(async () => {
      setHidden(true);
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(latest!.settings.draftEntry).toEqual(DRAFT);
    expect(await getSetting('draftEntry')).toEqual(DRAFT);
    setHidden(false);
  });
});
