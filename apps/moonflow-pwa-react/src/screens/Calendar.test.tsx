import 'fake-indexeddb/auto';
import { screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SETTINGS_DEFAULTS } from '../lib/db';
import type { Entry, Settings } from '../lib/types';
import { renderRouted } from '../test/render-with-router';
import { StateProvider } from '../state/store';
import { CalendarScreen } from './Calendar';

function renderCalendar(settings: Partial<Settings>, calendarMonth: string, entries: Entry[] = []) {
  return renderRouted(
    <StateProvider testState={{ settings: { ...SETTINGS_DEFAULTS, ...settings }, calendarMonth, entries }}>
      <CalendarScreen />
    </StateProvider>,
  );
}

describe('CalendarScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 7, 20));
  });
  afterEach(() => vi.useRealTimers());

  it('has no accessibility violations', async () => {
    const { container } = await renderCalendar({ lastPeriodStart: '2026-08-10' }, '2026-08');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('draws an estimated prediction too, marked as an estimate — same prediction Home shows', async () => {
    await renderCalendar({ lastPeriodStart: '2026-08-10' }, '2026-09');
    // 10 Aug + 28 = 7 Sep
    expect(screen.getByRole('button', { name: /^(September 7|7 September), predicted period \(estimate\)/ })).toBeInTheDocument();
  });

  it('labels the fertile window as an estimate that is not birth control', async () => {
    await renderCalendar({ lastPeriodStart: '2026-08-10' }, '2026-08');
    expect(screen.getByText(/not birth control/i)).toBeInTheDocument();
  });

  it('still shows the next predicted period while currently on a period', async () => {
    const entries = [
      { date: '2026-08-19', flow: 'medium' as const, symptoms: [], mood: null, note: '', updatedAt: 0 },
      { date: '2026-08-20', flow: 'medium' as const, symptoms: [], mood: null, note: '', updatedAt: 0 },
    ];
    await renderCalendar({ lastPeriodStart: '2026-08-19' }, '2026-09', entries);
    // 19 Aug + 28 = 16 Sep
    expect(screen.getByRole('button', { name: /^(September 16|16 September), predicted period/ })).toBeInTheDocument();
  });

  it('does not fade future days — their prediction colours carry the information', async () => {
    await renderCalendar({ lastPeriodStart: '2026-08-10' }, '2026-09');
    const day = screen.getByRole('button', { name: /^(September 7|7 September), predicted period/ });
    expect(day).toBeDisabled();
    expect(day.className).not.toMatch(/opacity-/);
  });

  it('renders without crashing when there is no start date at all', async () => {
    await renderCalendar({ lastPeriodStart: null }, '2026-08');
    expect(screen.getByRole('button', { name: /^(August 20|20 August)/ })).toBeInTheDocument();
  });
});
