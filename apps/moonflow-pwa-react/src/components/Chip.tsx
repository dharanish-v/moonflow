// src/components/Chip.tsx — multi-select option button (Symptoms). Ported
// look from log-entry.js's chipClasses: selected = soft accent (blue) tint,
// not a solid fill — visually distinct from Pill's solid selected state,
// same distinction the vanilla app's btn-soft/btn-secondary split drew.
// ADR-024: real 44px touch target.
import type * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';

const chipVariants = cva(
  'inline-flex min-h-11 items-center justify-center rounded-[var(--radius-pill)] border px-3 text-flow-small font-medium transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      selected: {
        true: 'border-accent/40 bg-accent/15 text-accent',
        false:
          'border-border/60 bg-transparent font-normal text-muted-foreground hover:border-border hover:text-foreground',
      },
    },
    defaultVariants: { selected: false },
  },
);

export interface ChipProps extends React.ComponentProps<'button'>, VariantProps<typeof chipVariants> {}

function Chip({ className, selected, ...props }: ChipProps) {
  return (
    <button
      type="button"
      data-slot="chip"
      aria-pressed={!!selected}
      className={cn(chipVariants({ selected, className }))}
      {...props}
    />
  );
}

export { Chip, chipVariants };
