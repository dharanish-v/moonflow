import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Entry } from '../lib/types';
import { CycleTrend, YearView } from './YearView';

const med = (date: string): Entry => ({ date, flow: 'medium', symptoms: [], mood: null, note: '', updatedAt: 0 });
const starts = ['2025-10-05', '2025-11-02', '2025-11-30', '2026-01-02', '2026-01-30', '2026-02-27', '2026-03-27', '2026-04-24', '2026-05-22', '2026-06-19', '2026-07-17', '2026-08-14', '2026-09-11'];
const entries = starts.flatMap((s) => [0, 1, 2].map((k) => {
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  const x = new Date(y, m - 1, d + k);
  return med(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`);
}));

describe('YearView (T92)', () => {
  it('shows the last 12 months, one row each, with a spoken summary', () => {
    render(<YearView entries={entries} today={new Date(2026, 8, 26)} />);
    expect(screen.getByRole('img', { name: /13 periods in the last 12 months/i })).toBeInTheDocument();
    expect(screen.getAllByTestId('year-row')).toHaveLength(12);
  });
});

describe('CycleTrend (T92)', () => {
  it('plots every cycle against the typical 24–38 day band', () => {
    render(<CycleTrend entries={entries} />);
    expect(screen.getByRole('img', { name: /12 cycles.*typical range 24–38 days/i })).toBeInTheDocument();
  });

  it('needs at least two cycles', () => {
    const { container } = render(<CycleTrend entries={entries.slice(0, 3)} />);
    expect(container).toBeEmptyDOMElement();
  });
});
