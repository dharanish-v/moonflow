import 'fake-indexeddb/auto';
import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SETTINGS_DEFAULTS } from '../lib/db';
import type { Entry } from '../lib/types';
import { renderRouted } from '../test/render-with-router';
import { StateProvider } from '../state/store';
import { buildReport } from '../lib/report';
import { ReportScreen } from './Report';

const med = (date: string, extra: Partial<Entry> = {}): Entry => ({ date, flow: 'medium', symptoms: [], mood: null, note: '', updatedAt: 0, ...extra });
const ENTRIES = [
  med('2025-04-01'), // older than 12 months — excluded
  med('2026-03-01', { symptoms: ['cramps'] }), med('2026-03-02', { symptoms: ['cramps'] }),
  med('2026-03-29'), med('2026-03-30'), med('2026-03-31'),
  med('2026-04-26', { symptoms: ['headache'] }),
];

describe('doctor report (T66)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 4, 10));
  });
  afterEach(() => vi.useRealTimers());

  it('summarises the last 12 months only', () => {
    const r = buildReport(ENTRIES, new Date(2026, 4, 10));
    expect(r.periods.map((p) => p.start)).toEqual(['2026-03-01', '2026-03-29', '2026-04-26']);
    expect(r.periods.map((p) => p.days)).toEqual([2, 3, 1]);
    expect(r.periods.map((p) => p.cycleLength)).toEqual([28, 28, null]);
    expect(r.from).toBe('2025-05-10');
  });

  it('renders a table a clinician can read and a print button', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    await renderRouted(<ReportScreen />, {
      wrapper: (c) => <StateProvider testState={{ entries: ENTRIES, settings: { ...SETTINGS_DEFAULTS, onboardingComplete: true } }}>{c}</StateProvider>,
    });
    expect(screen.getByRole('heading', { level: 1, name: 'Cycle report' })).toBeInTheDocument();
    const table = screen.getByRole('table', { name: /periods/i });
    expect(within(table).getAllByRole('row')).toHaveLength(4); // header + 3
    expect(screen.getByText(/not a medical record/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /print|save as pdf/i }));
    expect(print).toHaveBeenCalled();
  });
});
