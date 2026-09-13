// src/screens/Calendar.tsx — ported from screens/calendar.js. The day grid
// has no shadcn/Radix equivalent (no component library ships a
// cycle-tracking calendar) — stays hand-built, same as the vanilla app.
import { motion } from 'framer-motion';
import { useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { ChevronLeftIcon, ChevronRightIcon } from '../components/icons';
import {
  addDays,
  derivePeriods,
  diffDays,
  estimateFertileWindow,
  formatDate,
  parseDate,
  predictNextPeriod,
} from '../lib/cycle-math';
import { useAppDispatch, useAppState } from '../state/store';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type NavDirection = 'prev' | 'next' | null;

/** "Sep 26–30" (same month) or "Sep 29–Oct 3" (crossing one) — never a year,
 * this app's predictions never look far enough ahead to need one. */
function formatDateRange(startStr: string, endStr: string): string {
  const start = parseDate(startStr);
  const end = parseDate(endStr);
  const startLabel = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (startStr === endStr) return startLabel;
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const endLabel = end.toLocaleDateString(undefined, sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' });
  return `${startLabel}–${endLabel}`;
}

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
      <span className="text-[0.7rem] text-muted-foreground/70">{caption}</span>
    </div>
  );
}

const SLIDE_VARIANTS = {
  enter: (direction: NavDirection) => ({ opacity: 0, x: direction === 'prev' ? -24 : direction === 'next' ? 24 : 0 }),
  center: { opacity: 1, x: 0 },
};

export function CalendarScreen() {
  const { calendarMonth, entries, settings } = useAppState();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const navDirectionRef = useRef<NavDirection>(null);

  const [yearStr, monthStr] = calendarMonth.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startWeekday = firstOfMonth.getDay();
  const todayStr = formatDate(new Date());

  const periods = derivePeriods(entries);
  const loggedPeriodDates = new Set<string>();
  for (const p of periods) {
    let d = p.start;
    while (diffDays(d, p.end) >= 0) {
      loggedPeriodDates.add(d);
      d = addDays(d, 1);
    }
  }

  const prediction = predictNextPeriod(periods, settings);
  const predictedDates = new Set<string>();
  const fertileDates = new Set<string>();
  let fertilePeak: string | null = null;
  let nextPeriodRange: { start: string; end: string } | null = null;
  let fertileRange: { start: string; end: string } | null = null;
  if (prediction.confidence === 'confirmed' && prediction.date) {
    const lengths = periods.map((p) => diffDays(p.start, p.end) + 1);
    const avgLen = lengths.length ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length) : 5;
    for (let i = 0; i < avgLen; i++) predictedDates.add(addDays(prediction.date, i));
    nextPeriodRange = { start: prediction.date, end: addDays(prediction.date, avgLen - 1) };

    const fertile = estimateFertileWindow(prediction.date);
    fertilePeak = fertile.peak;
    let d = fertile.start;
    while (diffDays(d, fertile.end) >= 0) {
      fertileDates.add(d);
      d = addDays(d, 1);
    }
    fertileRange = { start: fertile.start, end: fertile.end };
  }

  // A fertile window that's already fully over reads as wrong sitting next
  // to an upcoming period date — only surface it while still current or
  // upcoming, same as the grid's own dots still show past dates but a
  // summary card is read as "what's next," not a history log.
  const fertileVisible = !!fertileRange && diffDays(todayStr, fertileRange.end) >= 0;

  const nextPeriodCaption = nextPeriodRange
    ? (() => {
        const daysToNext = diffDays(todayStr, nextPeriodRange.start);
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

  function handleSelectDate(dateStr: string) {
    navigate({ to: '/log', search: { date: dateStr } });
  }

  function handleChangeMonth(direction: 'prev' | 'next') {
    navDirectionRef.current = direction;
    const next = new Date(year, month - 1 + (direction === 'next' ? 1 : -1), 1);
    dispatch({ type: 'SET_CALENDAR_MONTH', month: `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}` });
  }

  const monthLabel = firstOfMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const direction = navDirectionRef.current;
  navDirectionRef.current = null;

  return (
    <div className="mx-auto box-border flex w-full max-w-[26rem] flex-1 flex-col px-4 py-5">
      <div className="mb-3.5 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon-touch"
          onClick={() => handleChangeMonth('prev')}
          aria-label="Previous month"
          className="rounded-full text-muted-foreground/60"
        >
          <ChevronLeftIcon className="size-[0.9rem]" />
        </Button>
        <span className="text-sm font-medium text-foreground">{monthLabel}</span>
        <Button
          variant="ghost"
          size="icon-touch"
          onClick={() => handleChangeMonth('next')}
          aria-label="Next month"
          className="rounded-full text-muted-foreground/60"
        >
          <ChevronRightIcon className="size-[0.9rem]" />
        </Button>
      </div>

      <motion.div
        key={calendarMonth}
        custom={direction}
        variants={SLIDE_VARIANTS}
        initial="enter"
        animate="center"
        transition={{ duration: 0.22, ease: 'easeOut' }}
      >
        <div className="grid grid-cols-7">
          {WEEKDAY_LABELS.map((l, i) => (
            <span key={i} className="pb-1.5 text-center text-xs text-muted-foreground/60">
              {l}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-[0.375rem]">
          {cells.map((dateStr, i) => {
            if (!dateStr) {
              return (
                <div key={i} className="flex aspect-square items-center justify-center">
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
              stateLabel = 'period day';
            } else if (dateStr === fertilePeak) {
              stateClass = 'border-[1.5px] border-primary bg-primary/30 font-medium';
              stateLabel = 'peak fertile day';
            } else if (fertileDates.has(dateStr)) {
              stateClass = 'bg-primary/15 text-foreground';
              stateLabel = 'fertile window';
            } else if (predictedDates.has(dateStr)) {
              stateClass = 'border-[1.5px] border-dashed border-secondary text-secondary';
              stateLabel = 'predicted period';
            }

            const spokenParts = [parseDate(dateStr).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })];
            if (stateLabel) spokenParts.push(stateLabel);
            if (isToday) spokenParts.push('today');

            return (
              <div key={dateStr} className="flex aspect-square items-center justify-center">
                <button
                  type="button"
                  disabled={isFuture}
                  onClick={() => handleSelectDate(dateStr)}
                  aria-label={spokenParts.join(', ')}
                  className={`flex size-10 items-center justify-center rounded-full text-xs text-foreground/80 disabled:cursor-default disabled:opacity-40 ${stateClass} ${isToday ? 'border-[1.5px] border-foreground' : ''}`}
                >
                  {dayNum}
                </button>
              </div>
            );
          })}
        </div>
      </motion.div>

      <div className="mt-2 flex justify-center gap-3.5 text-xs text-muted-foreground">
        <span>
          <span className="mr-1 inline-block size-2 rounded-full bg-secondary align-middle" />
          Period
        </span>
        <span>
          <span className="mr-1 inline-block size-2 rounded-full bg-primary/30 align-middle" />
          Fertile
        </span>
        <span>
          <span className="mr-1 inline-block size-2 rounded-full border-[1.5px] border-dashed border-secondary align-middle" />
          Next period
        </span>
      </div>

      {nextPeriodRange && (
        <Card className="mt-12">
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
        </Card>
      )}
    </div>
  );
}
