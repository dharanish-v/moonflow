// src/screens/Calendar.tsx — ported from screens/calendar.js. The day grid
// has no shadcn/Radix equivalent (no component library ships a
// cycle-tracking calendar) — stays hand-built, same as the vanilla app.
import { flushSync } from 'react-dom';
import { type TouchEvent, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { ChevronLeftIcon, ChevronRightIcon } from '../components/icons';
import { addDays, derivePeriods, diffDays, formatDate, parseDate } from '../lib/cycle-math';
import { computeForecast } from '../lib/forecast';
import { markPeriodDays, restoreDays } from '../lib/db';
import { offerUndo } from '../lib/undo-signal';
import { withViewTransition } from '../lib/motion';
import { FLOW_OPTIONS } from '../lib/constants';
import { FERTILE_DISCLAIMER, formatDateRange } from '../lib/home-status';
import { useAppDispatch, useAppState } from '../state/hooks';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** Minimum horizontal travel for a swipe to count as a month change. */
const SWIPE_MIN_PX = 50;

/** One stat in the summary card. The label is a small-caps "kicker" tinted
 * with the same color family the legend/grid already use for that state
 * (secondary for next-period, primary for fertile) — a color echo instead of
 * repeating the legend's dot shape right below it, which read as a second,
 * redundant legend. */
function SummaryStat({ accentClassName, label, value, caption }: { accentClassName: string; label: string; value: string; caption: string }) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <span className={`text-[0.65rem] font-semibold tracking-wide uppercase ${accentClassName}`}>{label}</span>
      <span className="text-base font-semibold text-foreground">{value}</span>
      <span className="text-[0.7rem] text-muted-foreground">{caption}</span>
    </div>
  );
}


export function CalendarScreen() {
  const { calendarMonth, entries, settings } = useAppState();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const [yearStr, monthStr] = calendarMonth.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startWeekday = firstOfMonth.getDay();
  const todayStr = formatDate(new Date());

  const periods = derivePeriods(entries);
  // Days with something logged but no period flow (symptoms, mood, notes).
  const loggedOtherDates = new Set(entries.map((e) => e.date));
  const entryByDate = new Map(entries.map((e) => [e.date, e]));
  const loggedPeriodDates = new Set<string>();
  for (const p of periods) {
    let d = p.start;
    while (diffDays(d, p.end) >= 0) {
      loggedPeriodDates.add(d);
      d = addDays(d, 1);
    }
  }

  // Same forecast Home reads (forecast.ts) — estimated predictions are drawn
  // too, labelled as estimates, so the two screens can never disagree.
  const forecast = computeForecast(entries, settings);
  const isEstimate = forecast.next?.confidence === 'estimated';
  const predictedDates = new Set<string>();
  const fertileDates = new Set<string>();
  let fertilePeak: string | null = null;
  let nextPeriodRange: { start: string; end: string } | null = null;
  let fertileRange: { start: string; end: string } | null = null;
  // On-period still has a valid next-cycle prediction; only 'late' has none.
  if (forecast.next && forecast.status !== 'late') {
    for (let i = 0; i < forecast.periodLength; i++) predictedDates.add(addDays(forecast.next.date, i));
    nextPeriodRange = { start: forecast.next.rangeStart, end: forecast.next.rangeEnd };
  }
  if (forecast.fertile) {
    fertilePeak = forecast.fertile.peak;
    let d = forecast.fertile.start;
    while (diffDays(d, forecast.fertile.end) >= 0) {
      fertileDates.add(d);
      d = addDays(d, 1);
    }
    fertileRange = { start: forecast.fertile.start, end: forecast.fertile.end };
  }
  const estimateSuffix = isEstimate ? ' (estimate)' : '';

  // A fertile window that's already fully over reads as wrong sitting next
  // to an upcoming period date — only surface it while still current or
  // upcoming, same as the grid's own dots still show past dates but a
  // summary card is read as "what's next," not a history log.
  const fertileVisible = !!fertileRange && diffDays(todayStr, fertileRange.end) >= 0;

  const nextPeriodCaption = nextPeriodRange
    ? (() => {
        const daysToNext = diffDays(todayStr, forecast.next!.date);
        if (daysToNext > 0) return `in ${daysToNext} day${daysToNext === 1 ? '' : 's'}`;
        if (daysToNext === 0) return 'starting today';
        return 'may be starting soon';
      })()
    : null;

  const fertileCaption =
    fertileVisible && fertileRange
      ? (() => {
          const daysToFertile = diffDays(todayStr, fertileRange.start);
          return daysToFertile > 0 ? `in ${daysToFertile} day${daysToFertile === 1 ? '' : 's'}` : 'happening now';
        })()
      : null;

  const cells: Array<string | null> = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(formatDate(new Date(year, month - 1, day)));
  // A month can span 4-6 calendar rows depending on its day count and start
  // weekday (e.g. Sept 2026 needs 5, Jan 2027 needs 6) — left as-is, the grid's
  // own height changes with it, pushing the legend/card below up or down on
  // every month change. Padding to a constant 6 rows (42 cells, the real max
  // any month can span) reuses the same invisible trailing-cell placeholder
  // the leading blanks already use, so everything below the grid stays put.
  while (cells.length < 42) cells.push(null);

  // T81: mark a whole period by picking its first and last day — a tap
  // range rather than a drag, so it can't fight the month swipe and works
  // with VoiceOver.
  const [marking, setMarking] = useState(false);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [markError, setMarkError] = useState(false);
  const selected = new Set<string>();
  if (rangeStart) {
    const [a, b] = rangeEnd && rangeEnd < rangeStart ? [rangeEnd, rangeStart] : [rangeStart, rangeEnd ?? rangeStart];
    for (let d = a; diffDays(d, b) >= 0; d = addDays(d, 1)) selected.add(d);
  }

  function stopMarking() {
    setMarking(false);
    setRangeStart(null);
    setRangeEnd(null);
  }

  async function saveMarkedPeriod() {
    const dates = [...selected].sort();
    const result = await markPeriodDays(dates);
    if (!result) {
      setMarkError(true);
      return;
    }
    setMarkError(false);
    for (const entry of result.saved) dispatch({ type: 'UPSERT_ENTRY', entry });
    stopMarking();
    offerUndo({
      message: `Marked ${dates.length} day${dates.length === 1 ? '' : 's'} as a period`,
      undo: async () => {
        if (!(await restoreDays(dates, result.previous))) return;
        dates.forEach((date, i) => {
          const prev = result.previous[i];
          dispatch(prev ? { type: 'UPSERT_ENTRY', entry: prev } : { type: 'REMOVE_ENTRY', date });
        });
      },
    });
  }

  function handleSelectDate(dateStr: string) {
    if (marking) {
      if (!rangeStart || rangeEnd) {
        setRangeStart(dateStr);
        setRangeEnd(null);
      } else {
        setRangeEnd(dateStr);
      }
      return;
    }
    navigate({ to: '/log', search: { date: dateStr, from: 'calendar' } });
  }

  // The new month slides in from the side it came from: a view transition
  // on the grid (index.css reads data-vt-dir), flushed synchronously so the
  // browser can snapshot old and new DOM.
  function handleChangeMonth(dir: 'prev' | 'next') {
    const next = new Date(year, month - 1 + (dir === 'next' ? 1 : -1), 1);
    const value = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
    document.documentElement.dataset.vtDir = dir;
    withViewTransition(() => flushSync(() => dispatch({ type: 'SET_CALENDAR_MONTH', month: value })));
  }

  const monthLabel = firstOfMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  /** Horizontal swipe on the grid changes month (spec'd scroll-snap
   * behaviour, QA "swiping left/right changes the visible month"). Mostly
   * vertical drags are left alone so the page can still scroll. */
  function onTouchStart(e: TouchEvent<HTMLDivElement>) {
    const t = e.touches[0];
    touchStartRef.current = t ? { x: t.clientX, y: t.clientY } : null;
  }
  function onTouchEnd(e: TouchEvent<HTMLDivElement>) {
    const start = touchStartRef.current;
    const t = e.changedTouches[0];
    touchStartRef.current = null;
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    handleChangeMonth(dx < 0 ? 'next' : 'prev');
  }

  const rows: Array<Array<string | null>> = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <div className="mx-auto box-border flex w-full max-w-[26rem] flex-1 flex-col px-4 py-5">
      <div className="mb-3.5 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon-touch"
          onClick={() => handleChangeMonth('prev')}
          aria-label="Previous month"
          className="rounded-full text-muted-foreground"
        >
          <ChevronLeftIcon className="size-[0.9rem]" />
        </Button>
        <h1 id="calendar-month" aria-live="polite" className="text-sm font-medium text-foreground">
          {monthLabel}
        </h1>
        <Button
          variant="ghost"
          size="icon-touch"
          onClick={() => handleChangeMonth('next')}
          aria-label="Next month"
          className="rounded-full text-muted-foreground"
        >
          <ChevronRightIcon className="size-[0.9rem]" />
        </Button>
      </div>

      <div className="calendar-grid">
        <div role="grid" aria-labelledby="calendar-month" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div role="row" className="grid grid-cols-7">
          {WEEKDAY_LABELS.map((l, i) => (
            <span key={i} role="columnheader" aria-label={WEEKDAY_NAMES[i]} className="pb-1.5 text-center text-xs text-muted-foreground">
              {l}
            </span>
          ))}
        </div>
        {rows.map((row, r) => (
        <div key={r} role="row" className="mb-[0.375rem] grid grid-cols-7 gap-[0.375rem]">
          {row.map((dateStr, c) => {
            const i = r * 7 + c;
            if (!dateStr) {
              return (
                <div key={i} role="gridcell" className="flex aspect-square items-center justify-center">
                  <span className="invisible size-10 rounded-full" />
                </div>
              );
            }

            const dayNum = Number(dateStr.split('-')[2]);
            const isFuture = diffDays(todayStr, dateStr) > 0;
            const isToday = dateStr === todayStr;

            let stateClass = '';
            let stateLabel = '';
            if (loggedPeriodDates.has(dateStr)) {
              stateClass = 'bg-secondary text-secondary-foreground';
              const flow = entryByDate.get(dateStr)?.flow;
              const flowLabel = FLOW_OPTIONS.find((f) => f.id === flow)?.label.toLowerCase();
              stateLabel = flowLabel && flow !== 'none' ? `period day, ${flowLabel} flow` : 'period day';
            } else if (dateStr === fertilePeak) {
              stateClass = 'bg-primary font-medium text-primary-foreground';
              stateLabel = `peak fertile day${estimateSuffix}`;
            } else if (fertileDates.has(dateStr)) {
              stateClass = 'border-[1.5px] border-primary text-foreground';
              stateLabel = `fertile window${estimateSuffix}`;
            } else if (predictedDates.has(dateStr)) {
              stateClass = 'border-[1.5px] border-dashed border-secondary text-secondary';
              stateLabel = `predicted period${estimateSuffix}`;
            } else if (loggedOtherDates.has(dateStr)) {
              stateLabel = 'logged';
            }

            const spokenParts = [parseDate(dateStr).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })];
            if (stateLabel) spokenParts.push(stateLabel);
            if (selected.has(dateStr)) spokenParts.push('selected');
            if (isToday) spokenParts.push('today');

            return (
              <div key={dateStr} role="gridcell" className="flex aspect-square items-center justify-center">
                <button
                  type="button"
                  disabled={isFuture}
                  onClick={() => handleSelectDate(dateStr)}
                  aria-label={spokenParts.join(', ')}
                  className={`relative flex size-10 items-center justify-center rounded-full text-sm text-foreground disabled:cursor-default ${stateClass} ${isFuture && !stateClass ? 'text-muted-foreground' : ''} ${isToday ? 'outline-2 outline-offset-2 outline-foreground' : ''} ${selected.has(dateStr) ? 'bg-accent/25 ring-2 ring-accent' : ''}`}
                >
                  {dayNum}
                  {loggedPeriodDates.has(dateStr) && (
                    // Shape as well as colour (WCAG 1.4.1): a droplet marks logged period days.
                    <svg data-marker="flow" aria-hidden="true" viewBox="0 0 8 10" className="absolute bottom-0.5 size-2 fill-current">
                      <path d="M4 0C4 0 0 4.6 0 6.6A4 4 0 0 0 8 6.6C8 4.6 4 0 4 0Z" />
                    </svg>
                  )}
                  {loggedOtherDates.has(dateStr) && !loggedPeriodDates.has(dateStr) && (
                    <span aria-hidden="true" className="absolute bottom-1 size-1 rounded-full bg-accent" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
        ))}
        </div>
      </div>

      <div className="mt-3">
        {marking ? (
          <div className="flex flex-col gap-2">
            <p className="text-center text-sm text-muted-foreground" aria-live="polite">
              {selected.size === 0 ? 'Tap the first and last day of the period' : `${selected.size} day${selected.size === 1 ? '' : 's'} selected`}
            </p>
            <div className="flex gap-2">
              <Button disabled={selected.size === 0} onClick={() => void saveMarkedPeriod()} className="h-11 flex-1 text-sm">
                Save as period
              </Button>
              <Button variant="ghost" onClick={stopMarking} className="h-11 flex-1 text-sm">
                Cancel
              </Button>
            </div>
            {markError && <p className="text-center text-sm text-destructive">Couldn't save — try again</p>}
          </div>
        ) : (
          <Button variant="outline" onClick={() => setMarking(true)} className="h-11 w-full text-sm">
            Mark a period
          </Button>
        )}
      </div>

      {forecast.fertileTooUncertain && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Your cycles vary too much to estimate a fertile window.
        </p>
      )}

      {forecast.status === 'paused' && (
        <p className="mt-2 text-center text-xs text-muted-foreground">Predictions are paused — only what you've logged is shown.</p>
      )}

      <div className="mt-2 flex justify-center gap-3.5 text-xs text-muted-foreground">
        <span>
          <svg aria-hidden="true" viewBox="0 0 8 10" className="mr-1 inline-block size-2.5 fill-secondary align-middle">
            <path d="M4 0C4 0 0 4.6 0 6.6A4 4 0 0 0 8 6.6C8 4.6 4 0 4 0Z" />
          </svg>
          Period
        </span>
        <span>
          <span className="mr-1 inline-block size-2 rounded-full border-[1.5px] border-primary align-middle" />
          Fertile
        </span>
        <span>
          <span className="mr-1 inline-block size-2 rounded-full border-[1.5px] border-dashed border-secondary align-middle" />
          Next period
        </span>
      </div>

      {nextPeriodRange && (
        <Card className="mt-6">
          <CardContent className={`grid gap-4 ${fertileVisible ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <SummaryStat
              accentClassName="text-secondary"
              label="Next period"
              value={formatDateRange(nextPeriodRange.start, nextPeriodRange.end)}
              caption={nextPeriodCaption!}
            />
            {fertileVisible && fertileRange && (
              <SummaryStat
                accentClassName="text-primary"
                label="Fertile window"
                value={formatDateRange(fertileRange.start, fertileRange.end)}
                caption={fertileCaption!}
              />
            )}
          </CardContent>
          {fertileVisible && (
            <p className="px-4 pb-3 text-center text-xs text-muted-foreground">{FERTILE_DISCLAIMER}</p>
          )}
        </Card>
      )}
    </div>
  );
}
