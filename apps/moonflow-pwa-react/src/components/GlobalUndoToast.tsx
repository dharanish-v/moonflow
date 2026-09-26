// src/components/GlobalUndoToast.tsx — renders the app-wide undo offer.
import { useSyncExternalStore } from 'react';
import { clearUndo, currentUndo, subscribeUndo } from '../lib/undo-signal';
import { UndoToast } from './UndoToast';

export function GlobalUndoToast() {
  const offer = useSyncExternalStore(subscribeUndo, currentUndo, currentUndo);
  if (!offer) return null;
  return (
    <UndoToast
      message={offer.message}
      onUndo={() => {
        clearUndo();
        void offer.undo();
      }}
      onDismiss={clearUndo}
    />
  );
}
