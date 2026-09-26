// src/state/store.tsx — Context+useReducer (ADR-007's split, inherited for
// free at a cheaper price: React's reconciler already diffs the real DOM, so
// this isn't accepting store.js's original coarse-re-render tradeoff, just a
// strictly cheaper version of it). Split State/Dispatch contexts so
// dispatch-only components never re-render on state changes.

import { createContext, type Dispatch, type ReactNode, useContext, useEffect, useReducer, useRef } from 'react';
import { todayString } from '../lib/cycle-math';
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
      try {
        const [entries, settings] = await Promise.all([loadAllEntries(), loadAllSettings()]);
        if (!cancelled) dispatch({ type: 'BOOT_LOADED', entries, settings });
      } catch (err) {
        console.error('Boot read failed:', err);
        if (!cancelled) dispatch({ type: 'BOOT_FAILED' });
      }
    })();
    return () => {
      cancelled = true;
    };
    // Boot runs once per mount, and again on each BOOT_RETRY — testState is a
    // fixed test-only seam, not a live prop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.bootAttempt]);

  // Day rollover (T59): re-check the date just after each midnight and
  // whenever the app comes back to the foreground (a PWA resumed from memory
  // the next morning would otherwise show yesterday).
  const todayRef = useRef(state.today);
  todayRef.current = state.today;
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      const now = todayString();
      if (now !== todayRef.current) dispatch({ type: 'DAY_CHANGED', today: now });
    };
    const schedule = () => {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
      timer = setTimeout(() => {
        check();
        schedule();
      }, nextMidnight.getTime() - now.getTime());
    };
    const onVisibility = () => {
      if (!document.hidden) check();
    };
    schedule();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
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
