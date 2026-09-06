// src/hooks/useRenderMode.ts — decides whether Home gets the real 3D moon or
// the static SVG fallback. Deliberately no battery-based branch:
// navigator.getBattery() doesn't exist in Safari/WebKit at all, and iOS Low
// Power Mode doesn't toggle prefers-reduced-motion — there's no real
// low-power signal to check, so the render itself just has to be cheap
// enough not to matter (frameloop="demand", no shadow maps, dpr capped at 1.5).
import { useEffect, useState } from 'react';

export type RenderMode = 'canvas3d' | 'fallback';

function supportsWebGL2(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!canvas.getContext('webgl2');
  } catch {
    return false;
  }
}

export function useRenderMode(): RenderMode {
  const [mode, setMode] = useState<RenderMode>('fallback');

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!prefersReducedMotion && supportsWebGL2()) setMode('canvas3d');
  }, []);

  return mode;
}
