// src/components/UpdatePrompt.tsx — T77: a new version never replaces the
// running one behind the user's back (or mid-entry). It waits for a tap.
import { useSyncExternalStore } from 'react';
import { dismissUpdate, pendingUpdate, subscribeUpdate } from '../lib/update-signal';
import { Button } from './ui/button';

export function UpdatePrompt() {
  const apply = useSyncExternalStore(subscribeUpdate, pendingUpdate, pendingUpdate);
  if (!apply) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+0.5rem)] z-30 mx-auto flex w-[min(24rem,calc(100%-2rem))] items-center justify-between gap-2 rounded-xl border border-border bg-popover px-4 py-2 text-sm text-popover-foreground shadow-lg"
    >
      <span>A new version is ready.</span>
      <span className="flex gap-1">
        <Button variant="ghost" onClick={dismissUpdate} className="h-11 px-3 text-sm text-muted-foreground">
          Later
        </Button>
        <Button onClick={apply} className="h-11 px-3 text-sm">
          Update
        </Button>
      </span>
    </div>
  );
}
