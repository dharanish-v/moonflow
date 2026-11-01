// src/hooks/useMinuteClock.ts — "now", refreshed once a minute, for labels
// like "Synced 5 min ago" without calling Date.now() during render.
import { useEffect, useState } from 'react';

export function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}
