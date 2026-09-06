// src/components/CycleSky.tsx — ambient full-frame background wash keyed to
// computeHomeStatus's cyclePhase (period/follicular/fertile/luteal/unknown).
// Deliberately separate from MoonPhase3D: the moon stays real astronomy
// (ADR-019), this is the app's own body-cycle signal. Sits inside
// #phone-frame (position: relative) so it's clipped by the frame's own
// border-radius on wide/mouse viewports — see App.tsx and index.css's
// #phone-frame rule. -z-10, not z-0: a positioned element with
// z-index:auto/0 paints above static in-flow content regardless of DOM
// order, which would bury #app-content under this background; negative
// z-index paints below the frame's own flat background instead, which is
// what an ambient backdrop needs.
import type { CyclePhase } from '../lib/home-status';

const SKY_VAR: Record<CyclePhase, string> = {
  period: 'var(--sky-period)',
  follicular: 'var(--sky-follicular)',
  fertile: 'var(--sky-fertile)',
  luteal: 'var(--sky-luteal)',
  unknown: 'var(--sky-unknown)',
};

export function CycleSky({ phase }: { phase: CyclePhase }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 transition-[background] duration-[1600ms] ease-out motion-reduce:transition-none"
      style={{ background: SKY_VAR[phase] }}
    />
  );
}
