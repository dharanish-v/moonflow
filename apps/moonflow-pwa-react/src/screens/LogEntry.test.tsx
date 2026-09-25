import 'fake-indexeddb/auto';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as db from '../lib/db';
import { validateLogSearch } from '../router/router';
import type { AppState } from '../state/actions';
import { renderRouted } from '../test/render-with-router';
import { StateProbe } from '../test/state-probe';
import { StateProvider } from '../state/store';
import { LogEntryScreen } from './LogEntry';

async function renderLog(date = '2026-09-06') {
  let latest: AppState | null = null;
  const utils = await renderRouted(<LogEntryScreen />, {
    path: '/log',
    initialEntries: [`/log?date=${date}`],
    validateSearch: validateLogSearch,
    wrapper: (children) => (
      <StateProvider testState={{}}>
        {children}
        <StateProbe onState={(s) => (latest = s)} />
      </StateProvider>
    ),
  });
  return { ...utils, state: () => latest! };
}

describe('LogEntryScreen', () => {
  afterEach(() => vi.restoreAllMocks());

  it('has no accessibility violations', async () => {
    const { container } = await renderLog();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('a failed save shows an error and changes nothing in state', async () => {
    vi.spyOn(db, 'saveEntryAndClearDraft').mockResolvedValue(null);
    const { state } = await renderLog();
    fireEvent.click(screen.getByRole('radio', { name: 'Medium' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText("Couldn't save — try again")).toBeInTheDocument();
    expect(state().entries).toEqual([]);
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('a successful save lands in state directly, without re-reading every entry', async () => {
    const reload = vi.spyOn(db, 'loadAllEntries');
    const { state } = await renderLog();
    fireEvent.click(screen.getByRole('radio', { name: 'Medium' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(state().entries.map((e) => e.flow)).toEqual(['medium']));
    expect(reload).not.toHaveBeenCalled();
  });
});
