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

describe('LogEntryScreen — form behaviour (T54)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('names every group and every mood in plain words', async () => {
    await renderLog();
    expect(screen.getByRole('radiogroup', { name: 'Flow' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Mood' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Symptoms' })).toBeInTheDocument();
    for (const label of ['Very low', 'Low', 'Okay', 'Good', 'Very happy']) {
      expect(screen.getByRole('radio', { name: label })).toBeInTheDocument();
    }
  });

  it('tapping a selected flow or mood again clears it', async () => {
    await renderLog();
    const medium = screen.getByRole('radio', { name: 'Medium' });
    fireEvent.click(medium);
    expect(medium).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(medium);
    expect(medium).toHaveAttribute('aria-checked', 'false');
    const good = screen.getByRole('radio', { name: 'Good' });
    fireEvent.click(good);
    fireEvent.click(good);
    expect(good).toHaveAttribute('aria-checked', 'false');
  });

  it('does not say "today" when logging a past day', async () => {
    await renderLog('2026-09-06');
    expect(screen.getByLabelText('Notes')).toHaveAttribute('placeholder', 'Add a note…');
  });

  it('asks before throwing away unsaved changes', async () => {
    await renderLog();
    fireEvent.click(screen.getByRole('radio', { name: 'Heavy' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(await screen.findByRole('alertdialog', { name: /discard changes/i })).toBeInTheDocument();
  });

  it('closes straight away when nothing changed, back to where it was opened from', async () => {
    const { router } = await renderRouted(<LogEntryScreen />, {
      path: '/log',
      initialEntries: ['/log?date=2026-09-06&from=insights'],
      validateSearch: validateLogSearch,
      wrapper: (children) => <StateProvider testState={{}}>{children}</StateProvider>,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/insights'));
  });

  it('after saving, returns to where it was opened from', async () => {
    const { router } = await renderRouted(<LogEntryScreen />, {
      path: '/log',
      initialEntries: ['/log?date=2026-09-06&from=calendar'],
      validateSearch: validateLogSearch,
      wrapper: (children) => <StateProvider testState={{}}>{children}</StateProvider>,
    });
    fireEvent.click(screen.getByRole('radio', { name: 'Light' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/calendar'));
  });
});
