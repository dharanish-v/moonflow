// src/hooks/usePrivacyScreen.ts — T49. iOS shows a snapshot of the app in the
// app switcher (and briefly on relaunch). Without a cover, that snapshot is
// a readable picture of someone's cycle data, visible to anyone who swipes
// up — even with the PIN lock on. Covering on hide means the snapshot is a
// plain navy screen.
import { useEffect } from 'react';

const CLASS = 'privacy-cover';

export function usePrivacyScreen() {
  useEffect(() => {
    const root = document.documentElement;
    const cover = () => root.classList.add(CLASS);
    const uncover = () => root.classList.remove(CLASS);
    const onVisibility = () => (document.hidden ? cover() : uncover());

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', cover);
    window.addEventListener('pageshow', uncover);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', cover);
      window.removeEventListener('pageshow', uncover);
      uncover();
    };
  }, []);
}
