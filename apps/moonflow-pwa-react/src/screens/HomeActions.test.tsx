import 'fake-indexeddb/auto';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SETTINGS_DEFAULTS, db } from '../lib/db';
import type { Entry } from '../lib/types';
import type { AppState } from '../state/actions';
import { renderRouted } from '../test/render-with-router';
import { StateProbe } from '../test/state-probe';
import { StateProvider } from '../state/store';
import { HomeScreen } from './Home';
import { GlobalUndoToast } from '../components/GlobalUndoToast';

const TODAY = '2026-09-26';
const e = (date: string, flow: Entry['flow'], extra: Partial<Entry> = {}): Entry => ({ date, flow, symptoms: [], mood: null, note: '', updatedAt: 1, ...extra });

async function renderHome(entries: Entry[]) {
  let latest: AppState | null = null;
  const utils = await renderRouted(<HomeScreen />, {
    wrapper: (children) => (
      <StateProvider testState={{ entries, settings: { ...SETTINGS_DEFAULTS, onboardingComplete: true, lastPeriodStart: '2026-09-01', lastBackupAt: Date.now() } }}>
        {children}
        <GlobalUndoToast />
        <StateProbe onState={(s) => (latest = s)} />
      </StateProvider>
    ),
  });
  return { ...utils, state: () => latest! };
}

describe('Home — contextual one-tap actions', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 26, 9));
    await db.entries.clear();
  });
  afterEach(() => vi.useRealTimers());

  it('"Period started today" logs today in one tap, with an undo', async () => {
    const { state } = await renderHome([e('2026-09-01', 'medium')]);
    fireEvent.click(screen.getByRole('button', { name: 'Period started today' }));
    // optimistic: in state immediately
    expect(state().entries.find((x) => x.date === TODAY)?.flow).toBe('medium');
    await waitFor(async () => expect((await db.entries.get(TODAY))?.flow).toBe('medium'));
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(state().entries.find((x) => x.date === TODAY)).toBeUndefined());
    await waitFor(async () => expect(await db.entries.get(TODAY)).toBeUndefined());
  });

  it('on a period, "Still on my period" repeats yesterday\'s flow for today', async () => {
    const { state } = await renderHome([e('2026-09-24', 'heavy'), e('2026-09-25', 'heavy')]);
    fireEvent.click(screen.getByRole('button', { name: 'Still on my period' }));
    expect(state().entries.find((x) => x.date === TODAY)?.flow).toBe('heavy');
  });

  it('once today is logged, shows what was logged and offers an edit instead', async () => {
    await renderHome([e('2026-09-01', 'medium'), e(TODAY, 'light', { symptoms: ['cramps', 'fatigue'] })]);
    expect(screen.getByText('Today: Light flow · 2 symptoms')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit today' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Period started today' })).not.toBeInTheDocument();
  });

  it('always keeps the full log sheet one tap away', async () => {
    await renderHome([e('2026-09-01', 'medium')]);
    expect(screen.getByRole('button', { name: /log symptoms, mood or notes/i })).toBeInTheDocument();
  });
});

describe('Home — missed period prompt (T78)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 4, 25, 9));
  });
  afterEach(() => vi.useRealTimers());
  const hist = ['2026-01-01', '2026-01-29', '2026-02-26', '2026-04-23', '2026-05-21'].map((d) => e(d, 'medium'));

  it('asks about a likely unlogged period and lets the user dismiss it', async () => {
    const { state } = await renderHome(hist);
    expect(screen.getByText(/did you miss logging a period around/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /no, that.s right/i }));
    await waitFor(() => expect(state().settings.confirmedLongCycles).toEqual(['2026-02-26']));
    expect(screen.queryByText(/did you miss logging/i)).not.toBeInTheDocument();
  });

  it('"Log it" opens that day', async () => {
    const { router } = await renderHome(hist);
    fireEvent.click(screen.getByRole('button', { name: 'Log it' }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ date: '2026-03-26' }));
  });
});
