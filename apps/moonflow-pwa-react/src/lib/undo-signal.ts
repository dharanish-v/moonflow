// src/lib/undo-signal.ts — one app-wide "did X — Undo" slot (T79), so an
// action taken on one screen (clearing a day in the log sheet) can still be
// undone after navigating back to another.
export interface UndoOffer {
  message: string;
  undo: () => void | Promise<void>;
}

let current: UndoOffer | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function offerUndo(offer: UndoOffer) {
  current = offer;
  emit();
}

export function clearUndo() {
  current = null;
  emit();
}

export function subscribeUndo(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function currentUndo(): UndoOffer | null {
  return current;
}
