// src/test/state-probe.tsx — renders nothing; hands the live app state to a
// test so it can assert what actually landed in the store.
import { useAppState } from '../state/hooks';
import type { AppState } from '../state/actions';

export function StateProbe({ onState }: { onState: (s: AppState) => void }) {
  onState(useAppState());
  return null;
}
