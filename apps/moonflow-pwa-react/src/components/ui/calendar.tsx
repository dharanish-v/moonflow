// src/components/ui/calendar.tsx — shadcn's Calendar pattern, wrapping
// react-day-picker v10 (no date-fns dependency — that would sit against
// ADR-020). Uses this app's own shadcn semantic tokens (bg-primary,
// bg-card, text-muted-foreground) — no bespoke design-token layer, same as
// everywhere else in the app. Onboarding's date picker is the one consumer
// today; the main Calendar screen's month grid stays its own hand-built
// component — it needs the period/fertile/predicted dots this generic
// picker has no concept of (see Calendar.tsx's own header comment).
import { DayPicker, type DayPickerProps } from 'react-day-picker';
import { buttonVariants } from './button';
import { ChevronLeftIcon, ChevronRightIcon } from '../icons';
import { cn } from 'cn';

function Calendar({ className, classNames, showOutsideDays = true, ...props }: DayPickerProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-0', className)}
      classNames={{
        months: 'flex flex-col gap-3.5',
        month: 'flex flex-col gap-2',
        month_caption: 'flex items-center justify-center px-8 text-sm font-medium text-foreground',
        nav: 'flex items-center justify-between absolute inset-x-0 top-0',
        button_previous: cn(buttonVariants({ variant: 'ghost', size: 'icon-touch' }), 'rounded-full text-muted-foreground/60'),
        button_next: cn(buttonVariants({ variant: 'ghost', size: 'icon-touch' }), 'rounded-full text-muted-foreground/60'),
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'flex-1 pb-1.5 text-center text-xs text-muted-foreground/60',
        week: 'flex w-full',
        day: 'flex-1 p-0.5',
        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'size-10 w-full rounded-full p-0 text-xs font-normal text-foreground/80',
        ),
        // aria-selected/data-today live on the day cell (a <td>), not the
        // button inside it — a first attempt styled aria-selected: on the
        // button itself and silently did nothing, caught live by actually
        // opening the picker rather than trusting the classNames alone.
        selected: '[&_button]:bg-primary [&_button]:text-primary-foreground [&_button]:font-medium',
        today: '[&_button]:border-[1.5px] [&_button]:border-foreground',
        outside: 'text-muted-foreground/40',
        disabled: 'text-muted-foreground/30 opacity-40',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ className: chevronClassName, orientation }) =>
          orientation === 'left' ? (
            <ChevronLeftIcon className={cn('size-4', chevronClassName)} />
          ) : (
            <ChevronRightIcon className={cn('size-4', chevronClassName)} />
          ),
      }}
      {...props}
    />
  );
}

export { Calendar };
