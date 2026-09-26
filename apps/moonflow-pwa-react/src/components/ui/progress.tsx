// src/components/ui/progress.tsx — Radix Progress renders a div-based
// track+fill under the hood (not a native <progress>), which is exactly
// what Insights.tsx's symptom-frequency bars needed by hand: native
// <progress> ignores accent-color in Chromium, a real cross-browser bug
// this app's "every color comes from our tokens" rule can't accept.
import * as React from 'react';
import { Progress as ProgressPrimitive } from 'radix-ui';
import { cn } from 'cn';

function Progress({
  className,
  value,
  indicatorClassName,
  indicatorStyle,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  /** e.g. a CSS grow-in (index.css mf-fill) for the fill. */
  indicatorClassName?: string;
  indicatorStyle?: React.CSSProperties;
}) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      className={cn('relative h-[0.375rem] w-full overflow-hidden rounded-full bg-border/40', className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn('h-full w-full flex-1 rounded-full bg-accent', indicatorClassName)}
        style={{ transform: `translateX(-${100 - (value ?? 0)}%)`, ...indicatorStyle }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
