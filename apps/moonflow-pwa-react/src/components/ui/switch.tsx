// src/components/ui/switch.tsx — Radix Switch, sized to ADR-024's documented
// exception (51×31px, Apple's own UISwitch proportions — the one control
// deliberately not raised to the flat 44×44px minimum, since a same-state
// toggle mis-tap is free).
import * as React from 'react';
import { Switch as SwitchPrimitive } from 'radix-ui';
import { cn } from 'cn';

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-full border border-transparent shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-[27px] rounded-full bg-foreground shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-[20px] data-[state=unchecked]:translate-x-0.5"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
