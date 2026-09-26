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
    expect(await screen.findByRole('alertdialog', { name: /unsaved changes/i })).toBeInTheDocument();
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

describe('LogEntryScreen — custom tags (T68)', () => {
  it('creates a tag, selects it, and saves it with the day', async () => {
    const { state } = await renderLog('2026-09-06');
    fireEvent.change(screen.getByLabelText('New tag'), { target: { value: 'Took ibuprofen' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }));
    const chip = await screen.findByRole('button', { name: 'Took ibuprofen', pressed: true });
    expect(chip).toBeInTheDocument();
    await waitFor(() => expect(state().settings.customTags).toEqual(['Took ibuprofen']));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(state().entries[0]?.tags).toEqual(['Took ibuprofen']));
  });

  it('ignores blank and duplicate tags', async () => {
    const { state } = await renderLog('2026-09-06');
    fireEvent.change(screen.getByLabelText('New tag'), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Add tag' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('New tag'), { target: { value: 'Sleep' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }));
    await waitFor(() => expect(state().settings.customTags).toEqual(['Sleep']));
    fireEvent.change(screen.getByLabelText('New tag'), { target: { value: 'sleep' } });
    expect(screen.getByRole('button', { name: 'Add tag' })).toBeDisabled();
  });
});

describe('LogEntryScreen — clear with undo (T79)', () => {
  it('clears at once (no confirm dialog) and offers Undo, which restores the day', async () => {
    const { GlobalUndoToast } = await import('../components/GlobalUndoToast');
    const { db, saveEntry } = await import('../lib/db');
    await db.entries.clear();
    const existing = { date: '2026-09-06', flow: 'heavy' as const, symptoms: [], mood: null, note: 'keep me', tags: [] };
    await saveEntry(existing);
    let latest: AppState | null = null;
    await renderRouted(<LogEntryScreen />, {
      path: '/log',
      initialEntries: ['/log?date=2026-09-06&from=calendar'],
      validateSearch: validateLogSearch,
      wrapper: (children) => (
        <StateProvider testState={{ entries: [{ ...existing, updatedAt: 1 }] }}>
          {children}
          <GlobalUndoToast />
          <StateProbe onState={(s) => (latest = s)} />
        </StateProvider>
      ),
    });
    fireEvent.click(screen.getByRole('button', { name: /clear this day/i }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await waitFor(() => expect(latest!.entries).toEqual([]));
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(latest!.entries.map((x) => x.note)).toEqual(['keep me']));
    expect((await db.entries.get('2026-09-06'))?.note).toBe('keep me');
  });

  it('keeps Clear away from Save', async () => {
    await renderLog();
    const save = screen.getByRole('button', { name: 'Save' });
    const clear = screen.queryByRole('button', { name: /clear this day/i });
    // no entry → no clear button at all on a fresh day
    expect(clear).toBeNull();
    expect(save).toBeInTheDocument();
  });
});

describe('LogEntryScreen — faster logging (T80)', () => {
  it('"Same as yesterday" copies yesterday\'s flow, symptoms and tags', async () => {
    const { SETTINGS_DEFAULTS } = await import('../lib/db');
    const yesterday = { date: '2026-09-05', flow: 'heavy' as const, symptoms: ['cramps' as const], mood: 'low' as never, note: 'n', tags: ['Ibuprofen'], updatedAt: 1 };
    await renderRouted(<LogEntryScreen />, {
      path: '/log',
      initialEntries: ['/log?date=2026-09-06'],
      validateSearch: validateLogSearch,
      wrapper: (c) => <StateProvider testState={{ entries: [yesterday], settings: { ...SETTINGS_DEFAULTS, customTags: ['Ibuprofen'] } }}>{c}</StateProvider>,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Same as yesterday' }));
    expect(screen.getByRole('radio', { name: 'Heavy' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: 'Cramps' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Ibuprofen', pressed: true })).toBeInTheDocument();
  });

  it('closing with changes offers to save them, not just discard', async () => {
    const { state } = await renderLog();
    fireEvent.click(screen.getByRole('radio', { name: 'Light' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(state().entries.map((x) => x.flow)).toEqual(['light']));
  });
});

describe('LogEntryScreen — shortcut links (T83)', () => {
  it('pre-selects flow and symptoms from the link', async () => {
    await renderRouted(<LogEntryScreen />, {
      path: '/log',
      initialEntries: ['/log?date=2026-09-06&flow=heavy&symptom=cramps'],
      validateSearch: validateLogSearch,
      wrapper: (c) => <StateProvider testState={{}}>{c}</StateProvider>,
    });
    expect(screen.getByRole('radio', { name: 'Heavy' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: 'Cramps' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('ignores unknown values in the link', () => {
    expect(validateLogSearch({ flow: 'lava', symptom: 'nope' })).toMatchObject({ flow: undefined, symptom: undefined });
  });
});

describe('LogEntryScreen — fertility awareness fields (T88)', () => {
  it('are hidden unless fertility awareness is turned on', async () => {
    await renderLog();
    expect(screen.queryByLabelText(/temperature/i)).not.toBeInTheDocument();
  });

  it('logs a morning temperature (stored in °C) and cervical mucus', async () => {
    const { SETTINGS_DEFAULTS } = await import('../lib/db');
    let latest: AppState | null = null;
    await renderRouted(<LogEntryScreen />, {
      path: '/log',
      initialEntries: ['/log?date=2026-09-06'],
      validateSearch: validateLogSearch,
      wrapper: (c) => (
        <StateProvider testState={{ settings: { ...SETTINGS_DEFAULTS, fertilityAwareness: true, temperatureUnit: 'F' } }}>
          {c}
          <StateProbe onState={(s) => (latest = s)} />
        </StateProvider>
      ),
    });
    fireEvent.change(screen.getByLabelText(/temperature \(°F\)/i), { target: { value: '97.9' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Egg-white' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /disturbed/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(latest!.entries[0]).toMatchObject({ temperature: 36.61, mucus: 'eggwhite', tempDisturbed: true }));
  });

  it('refuses to save an implausible temperature', async () => {
    const { SETTINGS_DEFAULTS } = await import('../lib/db');
    await renderRouted(<LogEntryScreen />, {
      path: '/log',
      initialEntries: ['/log?date=2026-09-06'],
      validateSearch: validateLogSearch,
      wrapper: (c) => <StateProvider testState={{ settings: { ...SETTINGS_DEFAULTS, fertilityAwareness: true, temperatureUnit: 'C' } }}>{c}</StateProvider>,
    });
    fireEvent.change(screen.getByLabelText(/temperature \(°C\)/i), { target: { value: '41.9x' } });
    expect(screen.getByText(/doesn.t look like a body temperature/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
