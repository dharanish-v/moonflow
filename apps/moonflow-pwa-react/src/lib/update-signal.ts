// src/lib/update-signal.ts — a one-slot signal from the service-worker
// registration (outside React) to the UpdatePrompt (inside it).
type Apply = () => void;
let pending: Apply | null = null;
const listeners = new Set<() => void>();

export function announceUpdate(apply: Apply) {
  pending = apply;
  for (const l of listeners) l();
}

export function dismissUpdate() {
  pending = null;
  for (const l of listeners) l();
}

export function subscribeUpdate(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function pendingUpdate(): Apply | null {
  return pending;
}
