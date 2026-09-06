// src/screens/Calendar.tsx — ported from screens/calendar.js. The day grid
// has no shadcn/Radix equivalent (no component library ships a
// cycle-tracking calendar) — stays hand-built, same as the vanilla app.
import { motion } from 'framer-motion';
import { useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '../components/ui/button';
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
  if (prediction.confidence === 'confirmed' && prediction.date) {
    const lengths = periods.map((p) => diffDays(p.start, p.end) + 1);
    const avgLen = lengths.length ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length) : 5;
    for (let i = 0; i < avgLen; i++) predictedDates.add(addDays(prediction.date, i));
  }

  const fertileDates = new Set<string>();
  let fertilePeak: string | null = null;
  if (prediction.confidence === 'confirmed' && prediction.date) {
    const fertile = estimateFertileWindow(prediction.date);
    fertilePeak = fertile.peak;
    let d = fertile.start;
    while (diffDays(d, fertile.end) >= 0) {
      fertileDates.add(d);
      d = addDays(d, 1);
    }
  }

  const cells: Array<string | null> = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(formatDate(new Date(year, month - 1, day)));

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
    <div className="mx-auto box-border flex w-full max-w-[26rem] flex-1 flex-col px-flow-5 py-flow-6">
      <div className="mb-flow-4 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon-touch"
          onClick={() => handleChangeMonth('prev')}
          aria-label="Previous month"
          className="rounded-full text-muted-foreground/60"
        >
          <ChevronLeftIcon className="size-[0.9rem]" />
        </Button>
        <span className="text-flow-nav font-medium text-foreground">{monthLabel}</span>
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
            <span key={i} className="pb-flow-2 text-center text-flow-micro text-muted-foreground/60">
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
                  className={`flex size-10 items-center justify-center rounded-full text-flow-small text-foreground/80 disabled:cursor-default disabled:opacity-40 ${stateClass} ${isToday ? 'border-[1.5px] border-foreground' : ''}`}
                >
                  {dayNum}
                </button>
              </div>
            );
          })}
        </div>
      </motion.div>

      <div className="mt-flow-4 flex justify-center gap-flow-4 text-flow-micro text-muted-foreground">
        <span>
          <span className="mr-flow-1 inline-block size-2 rounded-full bg-secondary align-middle" />
          Period
        </span>
        <span>
          <span className="mr-flow-1 inline-block size-2 rounded-full bg-primary/30 align-middle" />
          Fertile
        </span>
        <span>
          <span className="mr-flow-1 inline-block size-2 rounded-full border-[1.5px] border-dashed border-secondary align-middle" />
          Predicted
        </span>
      </div>
    </div>
  );
}
