// src/components/PhaseMotif.tsx — Home's decorative cycle-phase visual. A
// breathing crescent moon, recolored per cyclePhase using the same tokens
// the rest of the app already assigns to each phase (secondary=period,
// accent=follicular, primary=fertile — Calendar's fertile-peak ring and
// TabBar's active tab already use primary this way; muted-foreground for
// luteal/unknown, no new token invented for one small motif). Pure SVG +
// plain CSS keyframes (index.css), no image asset — same "no custom nothing except what the
// stack already provides" spirit as the rest of this rebuild.
import type * as React from 'react';
import type { CyclePhase, CycleRing } from '../lib/home-status';
import { PHASE_COLOR_CLASS } from '../lib/phase-colors';
import { moonPhase } from '../lib/lunar';

const MOON_R = 10;

/** Lit region for illumination k (0–1), drawn waxing (lit on the right):
 * the right half-limb, then back up along the terminator — an ellipse whose
 * x-radius shrinks to 0 at the quarter and bulges left past it (gibbous). */
function litPath(k: number): string {
  const r = MOON_R;
  const rx = Math.abs(1 - 2 * k) * r;
  const bulgeLeft = k > 0.5 ? 1 : 0;
  return `M 0 ${-r} A ${r} ${r} 0 0 1 0 ${r} A ${rx} ${r} 0 0 ${bulgeLeft} 0 ${-r} Z`;
}

// Ring geometry — a full lap = one predicted cycle (see CycleRing's own
// doc). Sized to sit inside the size-32 (128px) motif with room for the
// outer glow to still bleed past it.
const RING_SIZE = 112;
const RING_CENTER = RING_SIZE / 2;
const RING_RADIUS = 50;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** SVG's own 0° is 3 o'clock; CycleRing's angles are clock-face (0° = top,
 * day 1) — the -90° `transform` on each circle handles that, this only
 * converts a degree span into a dasharray of that arc's length. */
function arcDasharray(spanDegrees: number): string {
  const clamped = Math.max(0, Math.min(360, spanDegrees));
  const length = (clamped / 360) * RING_CIRCUMFERENCE;
  return `${length} ${RING_CIRCUMFERENCE - length}`;
}

function pointOnRing(angleDegrees: number): { x: number; y: number } {
  const rad = ((angleDegrees - 90) * Math.PI) / 180;
  return { x: RING_CENTER + RING_RADIUS * Math.cos(rad), y: RING_CENTER + RING_RADIUS * Math.sin(rad) };
}

/** @param label the ring's text alternative for VoiceOver (it carries real information). */
export function PhaseMotif({ cyclePhase, ring, label }: { cyclePhase: CyclePhase; ring: CycleRing | null; label?: string }) {
  const moon = moonPhase();
  const colorClass = PHASE_COLOR_CLASS[cyclePhase];
  const todayPoint = ring ? pointOnRing(ring.todayAngle) : null;
  const fertileSpan = ring ? ((ring.fertileEndAngle - ring.fertileStartAngle) % 360 + 360) % 360 : 0;

  return (
    <div
      className={`relative mx-auto mb-5 flex size-32 items-center justify-center ${colorClass}`}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {/* Two glow layers, not one — a single flat blur read as a small
          badge behind the moon; a wider, softer outer layer plus a
          tighter inner one gives the "surrounded by light" feel instead. */}
      <div
        className="mf-breathe absolute size-32 rounded-full bg-current opacity-10 blur-2xl"
        style={{ '--breathe-lo': 0.08, '--breathe-hi': 0.18 } as React.CSSProperties}
      />
      <div
        className="mf-breathe absolute size-20 rounded-full bg-current opacity-20 blur-lg"
        style={{ '--breathe-lo': 0.15, '--breathe-hi': 0.3, animationDuration: '4s' } as React.CSSProperties}
      />
      {/* The ring itself — static, not breathing like the glow/moon, since
          it's carrying real information (period/fertile arcs, today's
          position), not mood lighting. Colored via the same secondary/
          primary tokens Calendar's own legend already assigns to those
          exact states, so this reads as the same visual language, not a
          new one. */}
      {ring && (
        <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} className="absolute" fill="none">
          <circle cx={RING_CENTER} cy={RING_CENTER} r={RING_RADIUS} stroke="currentColor" strokeOpacity="0.12" strokeWidth="4" />
          <circle
            cx={RING_CENTER}
            cy={RING_CENTER}
            r={RING_RADIUS}
            stroke="var(--secondary)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={arcDasharray(ring.periodEndAngle)}
            transform={`rotate(-90 ${RING_CENTER} ${RING_CENTER})`}
          />
          {fertileSpan > 0 && (
            <circle
              cx={RING_CENTER}
              cy={RING_CENTER}
              r={RING_RADIUS}
              stroke="var(--primary)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={arcDasharray(fertileSpan)}
              strokeDashoffset={-(ring.fertileStartAngle / 360) * RING_CIRCUMFERENCE}
              transform={`rotate(-90 ${RING_CENTER} ${RING_CENTER})`}
            />
          )}
          {todayPoint && (
            <circle cx={todayPoint.x} cy={todayPoint.y} r="5" fill="var(--foreground)" stroke="var(--background)" strokeWidth="1.5" />
          )}
        </svg>
      )}
      {/* Today's real moon (ADR-019), offset-circle style: an unlit disc,
          the lit part bounded by the limb and an elliptical terminator,
          with a faint dot grain for an illustrated rather than flat look. */}
      <svg viewBox="-12 -12 24 24" className="mf-moon relative size-16">
        <defs>
          <pattern id="moon-grain" width="1.6" height="1.6" patternUnits="userSpaceOnUse">
            <circle cx="0.4" cy="0.4" r="0.22" fill="var(--primary-foreground)" fillOpacity="0.18" />
          </pattern>
        </defs>
        <circle r={MOON_R} fill="var(--muted)" />
        <g transform={moon.waxing ? undefined : 'scale(-1 1)'}>
          <path d={litPath(moon.illumination)} fill="var(--primary)" />
          <path d={litPath(moon.illumination)} fill="url(#moon-grain)" />
        </g>
      </svg>
    </div>
  );
}
