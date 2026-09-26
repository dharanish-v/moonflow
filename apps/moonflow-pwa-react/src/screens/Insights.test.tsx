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
