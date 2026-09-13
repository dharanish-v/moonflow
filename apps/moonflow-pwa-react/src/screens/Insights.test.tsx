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
