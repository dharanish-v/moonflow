// src/components/UndoToast.tsx — the spec'd "Cleared — Undo" pattern
// (design-system.md): act immediately, offer a way back, instead of asking
// "are you sure?" first. Sits above the tab bar; auto-dismisses.
import { useEffect } from 'react';
import { Button } from './ui/button';

export const UNDO_TOAST_MS = 6000;

export function UndoToast({ message, onUndo, onDismiss }: { message: string; onUndo: () => void; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, UNDO_TOAST_MS);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+5rem)] z-20 mx-auto flex w-[min(24rem,calc(100%-2rem))] items-center justify-between gap-3 rounded-xl border border-border bg-popover px-4 py-2 text-sm text-popover-foreground shadow-lg"
    >
      <span>{message}</span>
      <Button variant="ghost" onClick={onUndo} className="h-11 px-3 text-sm font-medium text-primary">
        Undo
      </Button>
    </div>
  );
}
