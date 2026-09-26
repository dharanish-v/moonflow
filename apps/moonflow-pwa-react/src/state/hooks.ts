// src/state/hooks.ts — the store's contexts and the hooks that read them, in
// their own module so store.tsx exports only its component (fast refresh).
import { createContext, type Dispatch, useContext } from 'react';
import type { Action, AppState } from './actions';

export const StateContext = createContext<AppState | null>(null);
export const DispatchContext = createContext<Dispatch<Action> | null>(null);

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
