// src/lib/perf-tier.ts — ADR-037. Local-only device-tier heuristic, not
// detect-gpu's default getGPUTier() path: that package is already installed
// transitively (a drei dependency), but its default benchmark lookup
// fetches JSON from unpkg.com — a live third-party network call this
// offline-first PWA's own ADR-002/ADR-022 stance forbids by default. This
// classifies from local-only signals instead: navigator.deviceMemory
// (Chrome-only, not in lib.dom.d.ts — accessed via a narrow local type),
// navigator.hardwareConcurrency, and a WEBGL_debug_renderer_info renderer-
// string check for known-weak mobile GPUs (the same technique detect-gpu
// itself uses internally, just without its network-dependent benchmark
// data). Paired at the call site with drei's real PerformanceMonitor for
// continuous runtime auto-downgrade — this is only the *initial* guess.
//
// classifyPerfTier is the pure, unit-tested core; detectPerfTier is the
// thin impure shell (reads navigator, creates a throwaway canvas) —
// untestable in jsdom, same "no WebGL/canvas in jsdom" split the rest of
// this app's rendering code already draws.
export type PerfTier = 'low' | 'medium' | 'high';

// Real WEBGL_debug_renderer_info strings interpose vendor noise between the
// GPU family and its model number (e.g. "Adreno (TM) 308", not "Adreno
// 308") — matched loosely (.*) rather than a literal space, caught live by
// this file's own test suite failing against a real-shaped string.
const WEAK_GPU_PATTERN = /(mali-4\d\d|adreno.*3\d\d|powervr sgx|intel hd graphics [23]000)/i;

export function classifyPerfTier(deviceMemoryGb: number, cpuCores: number, rendererString: string | null): PerfTier {
  const weakGpu = rendererString !== null && WEAK_GPU_PATTERN.test(rendererString);
  if (weakGpu || deviceMemoryGb <= 2 || cpuCores <= 2) return 'low';
  if (deviceMemoryGb >= 8 && cpuCores >= 6) return 'high';
  return 'medium';
}

function getUnmaskedRenderer(): string | null {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return null;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return null;
    return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string;
  } catch {
    return null;
  }
}

const VALID_TIERS: readonly PerfTier[] = ['low', 'medium', 'high'];

export function detectPerfTier(): PerfTier {
  // Dev-only escape hatch for live verification (?perfTier=low|medium|high)
  // — lets Phase 6/7's "confirm visible differences at each tier" checks
  // force a tier without needing to actually throttle a device to match it.
  // Never affects a real user unless they hand-edit the URL.
  const forced = new URLSearchParams(window.location.search).get('perfTier');
  if (forced !== null && (VALID_TIERS as string[]).includes(forced)) return forced as PerfTier;
  // deviceMemory is a real, shipped Chrome/Android API with no official TS
  // lib.dom.d.ts entry (and no support at all in Safari/iOS) — undefined
  // there falls back to a middling default rather than assuming 'low'.
  const deviceMemoryGb = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const cpuCores = navigator.hardwareConcurrency ?? 4;
  return classifyPerfTier(deviceMemoryGb, cpuCores, getUnmaskedRenderer());
}
