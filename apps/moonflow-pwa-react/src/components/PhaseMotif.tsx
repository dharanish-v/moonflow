// src/components/PhaseMotif.tsx — Home's decorative cycle-phase visual. A
// breathing crescent moon, recolored per cyclePhase using the same tokens
// the rest of the app already assigns to each phase (secondary=period,
// accent=follicular, primary=fertile — Calendar's fertile-peak ring and
// TabBar's active tab already use primary this way; muted-foreground for
// luteal/unknown, no new token invented for one small motif). Pure SVG +
// Framer Motion, no image asset — same "no custom nothing except what the
// stack already provides" spirit as the rest of this rebuild.
import { motion, useReducedMotion } from 'framer-motion';
import type { CyclePhase, CycleRing } from '../lib/home-status';

const PHASE_COLOR_CLASS: Record<CyclePhase, string> = {
  period: 'text-secondary',
  follicular: 'text-accent',
  fertile: 'text-primary',
  luteal: 'text-muted-foreground',
  unknown: 'text-muted-foreground',
};

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

export function PhaseMotif({ cyclePhase, ring }: { cyclePhase: CyclePhase; ring: CycleRing | null }) {
  const prefersReducedMotion = useReducedMotion();
  const colorClass = PHASE_COLOR_CLASS[cyclePhase];
  const todayPoint = ring ? pointOnRing(ring.todayAngle) : null;
  const fertileSpan = ring ? ((ring.fertileEndAngle - ring.fertileStartAngle) % 360 + 360) % 360 : 0;

  return (
    <div className={`relative mx-auto mb-5 flex size-32 items-center justify-center ${colorClass}`} aria-hidden="true">
      {/* Two glow layers, not one — a single flat blur read as a small
          badge behind the moon; a wider, softer outer layer plus a
          tighter inner one gives the "surrounded by light" feel instead. */}
      <motion.div
        className="absolute size-32 rounded-full bg-current opacity-10 blur-2xl"
        animate={prefersReducedMotion ? undefined : { opacity: [0.08, 0.18, 0.08], scale: [1, 1.1, 1] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute size-20 rounded-full bg-current opacity-20 blur-lg"
        animate={prefersReducedMotion ? undefined : { opacity: [0.15, 0.3, 0.15], scale: [1, 1.15, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
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
      <motion.svg
        viewBox="0 0 24 24"
        fill="none"
        className="relative size-16"
        animate={prefersReducedMotion ? undefined : { scale: [1, 1.06, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36A5.4 5.4 0 0 1 12 3z" fill="currentColor" />
      </motion.svg>
    </div>
  );
}
