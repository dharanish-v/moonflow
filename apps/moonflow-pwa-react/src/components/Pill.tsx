// src/components/Pill.tsx — single-select option button (Flow). Ported look
// from log-entry.js's pillClasses: selected = solid secondary fill,
// unselected = calm/muted outline, never a bright default outline
// (design-system.md's chip spec: "unselected = transparent + border-muted +
// text-muted", not full-strength foreground for both states).
// ADR-024: real 44px touch target — min-h-11, not the vanilla app's 26px.
import type * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';

const pillVariants = cva(
  'inline-flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-[var(--radius-pill)] border px-2 text-flow-small font-medium transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      selected: {
        true: 'border-transparent bg-secondary text-secondary-foreground',
        false:
          'border-border/60 bg-transparent font-normal text-muted-foreground hover:border-border hover:text-foreground',
      },
    },
    defaultVariants: { selected: false },
  },
);

export interface PillProps extends React.ComponentProps<'button'>, VariantProps<typeof pillVariants> {}

function Pill({ className, selected, ...props }: PillProps) {
  return (
    <button
      type="button"
      data-slot="pill"
      aria-pressed={!!selected}
      className={cn(pillVariants({ selected, className }))}
      {...props}
    />
  );
}

export { Pill, pillVariants };
