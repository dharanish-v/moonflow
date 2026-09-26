import 'fake-indexeddb/auto';
import { fireEvent, screen } from '@testing-library/react';
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

  it('is a real grid, with the month as a heading that is announced on change', async () => {
    await renderCalendar({ lastPeriodStart: '2026-08-10' }, '2026-08');
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent(/August 2026/);
    expect(heading).toHaveAttribute('aria-live', 'polite');
    const grid = screen.getByRole('grid', { name: /August 2026/ });
    expect(grid.querySelectorAll('[role="row"]').length).toBeGreaterThanOrEqual(5);
    expect(screen.getAllByRole('columnheader')).toHaveLength(7);
  });

  it('swiping left shows the next month, swiping right the previous one', async () => {
    await renderCalendar({ lastPeriodStart: '2026-08-10' }, '2026-08');
    const grid = screen.getByRole('grid');
    fireEvent.touchStart(grid, { touches: [{ clientX: 300, clientY: 400 }] });
    fireEvent.touchEnd(grid, { changedTouches: [{ clientX: 120, clientY: 410 }] });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/September 2026/);
    fireEvent.touchStart(screen.getByRole('grid'), { touches: [{ clientX: 100, clientY: 400 }] });
    fireEvent.touchEnd(screen.getByRole('grid'), { changedTouches: [{ clientX: 300, clientY: 400 }] });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/August 2026/);
  });

  it('a mostly vertical swipe does not change month', async () => {
    await renderCalendar({ lastPeriodStart: '2026-08-10' }, '2026-08');
    const grid = screen.getByRole('grid');
    fireEvent.touchStart(grid, { touches: [{ clientX: 300, clientY: 100 }] });
    fireEvent.touchEnd(grid, { changedTouches: [{ clientX: 200, clientY: 400 }] });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/August 2026/);
  });

  it('marks days logged with only symptoms or mood', async () => {
    const entries = [{ date: '2026-08-05', flow: null, symptoms: ['headache' as const], mood: null, note: '', updatedAt: 0 }];
    await renderCalendar({ lastPeriodStart: '2026-08-10' }, '2026-08', entries);
    expect(screen.getByRole('button', { name: /^(August 5|5 August), logged/ })).toBeInTheDocument();
  });

  it('draws no predictions while paused', async () => {
    await renderCalendar({ lastPeriodStart: '2026-08-10', predictionsPaused: true }, '2026-09');
    expect(screen.queryByRole('button', { name: /predicted period|fertile/ })).not.toBeInTheDocument();
    expect(screen.getByText(/predictions are paused/i)).toBeInTheDocument();
  });

  it('renders without crashing when there is no start date at all', async () => {
    await renderCalendar({ lastPeriodStart: null }, '2026-08');
    expect(screen.getByRole('button', { name: /^(August 20|20 August)/ })).toBeInTheDocument();
  });
});
