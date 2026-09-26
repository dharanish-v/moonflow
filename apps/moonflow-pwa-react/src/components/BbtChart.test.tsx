import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Entry, MucusId } from '../lib/types';
import { BbtChart } from './BbtChart';

const LOW = [36.3, 36.35, 36.4, 36.3, 36.35, 36.4, 36.45, 36.35, 36.4, 36.3, 36.4, 36.35];
function cycle(start: number, month = 2): Entry[] {
  const temps = [...LOW, 36.6, 36.62, 36.7, 36.72];
  return temps.map((temp, i) => {
    const d = new Date(2026, month, start + i);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const mucus: MucusId = i === 10 || i === 11 ? 'eggwhite' : i > 7 && i < 12 ? 'creamy' : 'dry';
    return { date, flow: i < 4 ? 'medium' : null, symptoms: [], mood: null, note: '', updatedAt: 0, temperature: temp, mucus, tempDisturbed: i === 5 };
  });
}

describe('BbtChart (T90)', () => {
  it('summarises the cycle for screen readers and offers the readings as a table', () => {
    render(<BbtChart entries={cycle(1)} unit="C" />);
    expect(screen.getByRole('img', { name: /coverline 36\.45 °C.*ovulation confirmed/i })).toBeInTheDocument();
    const table = screen.getByRole('table', { name: /temperature readings/i });
    expect(within(table).getAllByRole('row')).toHaveLength(17); // header + 16 days
    expect(within(table).getByText(/disturbed/i)).toBeInTheDocument();
  });

  it('shows °F when that is the chosen unit', () => {
    render(<BbtChart entries={cycle(1)} unit="F" />);
    expect(screen.getByRole('img', { name: /coverline 97\.61 °F/i })).toBeInTheDocument();
  });

  it('steps back to earlier cycles', () => {
    const entries = [...cycle(1), ...cycle(27)];
    render(<BbtChart entries={entries} unit="C" />);
    expect(screen.getByText(/cycle starting 27 Mar|cycle starting Mar 27/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Previous cycle' }));
    expect(screen.getByText(/cycle starting 1 Mar|cycle starting Mar 1/i)).toBeInTheDocument();
  });

  it('renders nothing without any temperatures', () => {
    const { container } = render(<BbtChart entries={[]} unit="C" />);
    expect(container.textContent).toMatch(/no temperatures logged/i);
  });
});
