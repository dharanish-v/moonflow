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
  indicatorRef,
  animated = false,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  indicatorRef?: React.Ref<HTMLDivElement>;
  /** When a caller drives the indicator's transform imperatively (a grow-in
   * animation via a ref), the initial render must start empty regardless of
   * `value` — otherwise it paints at the final position for one frame
   * before the animation resets and re-plays it. `value` still always
   * drives aria-valuenow, since that's read once, not repainted per frame. */
  animated?: boolean;
}) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      className={cn('relative h-[0.375rem] w-full overflow-hidden rounded-full bg-border/40', className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        ref={indicatorRef}
        data-slot="progress-indicator"
        className="h-full w-full flex-1 rounded-full bg-accent transition-transform"
        style={{ transform: `translateX(-${100 - (animated ? 0 : (value ?? 0))}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
