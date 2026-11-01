// src/lib/sync-signal.ts — T99. db.ts calls notifyLocalChange() after every
// write that sync must send; the sync hook debounces it. Kept dependency-free
// so db.ts can import it without a cycle.
const listeners = new Set<() => void>();

export function notifyLocalChange() {
  listeners.forEach((l) => l());
}

export function subscribeLocalChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Bumped whenever the signed-in session changes (sign-in, sign-out, erase).
// A sync run captures it at the start and stops before any write if it has
// moved, so a run in flight can't write a signed-out session back or push into
// an account that was just swapped out.
let epoch = 0;

export function bumpSessionEpoch() {
  epoch++;
}

export function sessionEpoch(): number {
  return epoch;
}
