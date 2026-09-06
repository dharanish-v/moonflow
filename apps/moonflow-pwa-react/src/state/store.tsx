// src/state/store.tsx — Context+useReducer (ADR-007's split, inherited for
// free at a cheaper price: React's reconciler already diffs the real DOM, so
// this isn't accepting store.js's original coarse-re-render tradeoff, just a
// strictly cheaper version of it). Split State/Dispatch contexts so
// dispatch-only components never re-render on state changes.

import { createContext, type Dispatch, type ReactNode, useContext, useEffect, useReducer } from 'react';
import { loadAllEntries, loadAllSettings } from '../lib/db';
import { type Action, type AppState, initialState, reducer } from './actions';

const StateContext = createContext<AppState | null>(null);
const DispatchContext = createContext<Dispatch<Action> | null>(null);

export interface StateProviderProps {
  children: ReactNode;
  /** Test-only seam: inject state directly instead of booting from IndexedDB. */
  testState?: Partial<AppState>;
}

export function StateProvider({ children, testState }: StateProviderProps) {
  const [state, dispatch] = useReducer(
    reducer,
    testState ? { ...initialState, ...testState, booted: true } : initialState,
  );

  useEffect(() => {
    if (testState) return;
    let cancelled = false;
    void (async () => {
      const [entries, settings] = await Promise.all([loadAllEntries(), loadAllSettings()]);
      if (!cancelled) dispatch({ type: 'BOOT_LOADED', entries, settings });
    })();
    return () => {
      cancelled = true;
    };
    // Boot runs exactly once per mount — testState is a fixed test-only seam, not a live prop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  );
}

export function useAppState(): AppState {
  const ctx = useContext(StateContext);
  if (!ctx) throw new Error('useAppState must be used within StateProvider');
  return ctx;
}

export function useAppDispatch(): Dispatch<Action> {
  const ctx = useContext(DispatchContext);
  if (!ctx) throw new Error('useAppDispatch must be used within StateProvider');
  return ctx;
}
