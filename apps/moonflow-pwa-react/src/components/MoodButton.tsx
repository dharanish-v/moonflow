// src/components/MoodButton.tsx — circular mood-option button. Ported look
// from log-entry.js's moodClasses: selected = soft primary (gold) tint
// circle, unselected = plain dimmed icon, no border/fill. Which specific
// icon renders per mood is a Phase 4 screen decision (MOOD_OPTIONS), not
// this primitive's concern — it just takes one.
// ADR-024: real 44px circular touch target.
import type * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';

const moodButtonVariants = cva(
  'inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-5',
  {
    variants: {
      selected: {
        true: 'bg-primary/15 text-primary',
        false: 'text-muted-foreground/70 hover:text-foreground',
      },
    },
    defaultVariants: { selected: false },
  },
);

export interface MoodButtonProps
  extends React.ComponentProps<'button'>,
    VariantProps<typeof moodButtonVariants> {}

function MoodButton({ className, selected, ...props }: MoodButtonProps) {
  return (
    <button
      type="button"
      data-slot="mood-button"
      aria-pressed={!!selected}
      className={cn(moodButtonVariants({ selected, className }))}
      {...props}
    />
  );
}

export { MoodButton, moodButtonVariants };
