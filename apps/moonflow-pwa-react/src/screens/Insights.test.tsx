import 'fake-indexeddb/auto';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { renderRouted } from '../test/render-with-router';
import { StateProvider } from '../state/store';
import { InsightsScreen } from './Insights';
import type { Entry } from '../lib/types';

const ENTRIES: Entry[] = [
  { date: '2026-06-01', flow: 'medium', symptoms: ['cramps'], mood: null, note: '', updatedAt: 0 },
  { date: '2026-06-29', flow: 'medium', symptoms: ['headache'], mood: null, note: '', updatedAt: 0 },
];

describe('InsightsScreen', () => {
  it('has no accessibility violations in the empty state', async () => {
    // Uses the real router harness (not a bare render()) — the recent-logs
    // list's rows call useNavigate(), which needs real router context to
    // exist at all, even before any row is ever clicked.
    const { container } = await renderRouted(
      <StateProvider testState={{}}>
        <InsightsScreen />
      </StateProvider>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no accessibility violations in the populated state', async () => {
    const { container } = await renderRouted(
      <StateProvider testState={{ entries: ENTRIES }}>
        <InsightsScreen />
      </StateProvider>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('InsightsScreen — copy (T63)', () => {
  it('spells out units and says what was counted', async () => {
    const { renderRouted } = await import('../test/render-with-router');
    const { StateProvider } = await import('../state/store');
    const { InsightsScreen } = await import('./Insights');
    const { screen } = await import('@testing-library/react');
    const med = (date: string) => ({ date, flow: 'medium' as const, symptoms: [], mood: null, note: '', updatedAt: 0 });
    await renderRouted(
      <StateProvider testState={{ entries: [med('2026-06-01'), med('2026-06-02'), med('2026-06-29'), med('2026-06-30'), med('2026-07-27')] }}>
        <InsightsScreen />
      </StateProvider>,
    );
    expect(screen.getByText('2 days')).toBeInTheDocument();
    expect(screen.getByText('Periods logged')).toBeInTheDocument();
    expect(screen.queryByText(/\dd$/)).not.toBeInTheDocument();
  });
});

describe('InsightsScreen — health nudges (T64)', () => {
  it('shows a calm nudge for a persistent pattern, plus when to get urgent care', async () => {
    const { renderRouted } = await import('../test/render-with-router');
    const { StateProvider } = await import('../state/store');
    const { InsightsScreen } = await import('./Insights');
    const { screen } = await import('@testing-library/react');
    const long = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-05-${String(i + 1).padStart(2, '0')}`,
      flow: 'medium' as const,
      symptoms: [],
      mood: null,
      note: '',
      updatedAt: 0,
    }));
    await renderRouted(
      <StateProvider testState={{ entries: long }}>
        <InsightsScreen />
      </StateProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Worth knowing' })).toBeInTheDocument();
    expect(screen.getByText('One of your recent periods lasted a while')).toBeInTheDocument();
    expect(screen.getByText(/get urgent care if you soak through/i)).toBeInTheDocument();
  });
});

describe('InsightsScreen — symptom timing (T69)', () => {
  it('says when a recurring symptom usually shows up', async () => {
    const { renderRouted } = await import('../test/render-with-router');
    const { StateProvider } = await import('../state/store');
    const { InsightsScreen } = await import('./Insights');
    const { screen } = await import('@testing-library/react');
    const e = (date: string, symptoms: Array<'cramps'> = []) => ({ date, flow: 'medium' as const, symptoms, mood: null, note: '', updatedAt: 0 });
    await renderRouted(
      <StateProvider testState={{ entries: [e('2026-03-01', ['cramps']), e('2026-03-29', ['cramps']), e('2026-04-26', ['cramps'])] }}>
        <InsightsScreen />
      </StateProvider>,
    );
    expect(screen.getByRole('heading', { name: 'When symptoms show up' })).toBeInTheDocument();
    const item = screen.getAllByRole('listitem').find((li) => li.textContent?.startsWith('Cramps'));
    expect(item).toHaveTextContent('Cramps usually around day 1');
  });
});

describe('InsightsScreen — search (T70)', () => {
  it('searches every logged day by note, tag or symptom', async () => {
    const { renderRouted } = await import('../test/render-with-router');
    const { StateProvider } = await import('../state/store');
    const { InsightsScreen } = await import('./Insights');
    const { fireEvent, screen } = await import('@testing-library/react');
    const e = (date: string, extra: object) => ({ date, flow: null, symptoms: [], mood: null, note: '', updatedAt: 0, ...extra });
    const entries = [
      e('2025-01-10', { note: 'Dentist, felt dizzy' }),
      ...Array.from({ length: 15 }, (_, i) => e(`2026-02-${String(i + 1).padStart(2, '0')}`, { note: 'ok' })),
      e('2026-03-01', { tags: ['Ibuprofen'] }),
      e('2026-03-02', { symptoms: ['headache'] }),
    ];
    await renderRouted(
      <StateProvider testState={{ entries }}>
        <InsightsScreen />
      </StateProvider>,
    );
    const box = screen.getByRole('searchbox', { name: /search your logs/i });
    fireEvent.change(box, { target: { value: 'dizzy' } });
    expect(screen.getAllByRole('button', { name: /10 Jan 2025|Jan 10, 2025/ })).toHaveLength(1);
    fireEvent.change(box, { target: { value: 'ibuprofen' } });
    expect(screen.getByText(/1 day found/)).toBeInTheDocument();
    fireEvent.change(box, { target: { value: 'headache' } });
    expect(screen.getByText(/1 day found/)).toBeInTheDocument();
  });
});

describe('InsightsScreen — temperature chart (T90)', () => {
  it('appears when fertility awareness is on', async () => {
    const { renderRouted } = await import('../test/render-with-router');
    const { StateProvider } = await import('../state/store');
    const { InsightsScreen } = await import('./Insights');
    const { SETTINGS_DEFAULTS } = await import('../lib/db');
    const { screen } = await import('@testing-library/react');
    const entries = [{ date: '2026-03-01', flow: 'medium' as const, symptoms: [], mood: null, note: '', updatedAt: 0, temperature: 36.4 }];
    await renderRouted(
      <StateProvider testState={{ entries, settings: { ...SETTINGS_DEFAULTS, fertilityAwareness: true, temperatureUnit: 'C' } }}>
        <InsightsScreen />
      </StateProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Temperature' })).toBeInTheDocument();
  });
});
