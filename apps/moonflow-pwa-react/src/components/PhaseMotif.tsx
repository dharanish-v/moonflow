// src/components/PhaseMotif.tsx — Home's decorative cycle-phase visual. A
// breathing crescent moon, recolored per cyclePhase using the same tokens
// the rest of the app already assigns to each phase (secondary=period,
// accent=follicular, primary=fertile — Calendar's fertile-peak ring and
// TabBar's active tab already use primary this way; muted-foreground for
// luteal/unknown, no new token invented for one small motif). Pure SVG +
// Framer Motion, no image asset — same "no custom nothing except what the
// stack already provides" spirit as the rest of this rebuild.
import { motion, useReducedMotion } from 'framer-motion';
import type { CyclePhase } from '../lib/home-status';

const PHASE_COLOR_CLASS: Record<CyclePhase, string> = {
  period: 'text-secondary',
  follicular: 'text-accent',
  fertile: 'text-primary',
  luteal: 'text-muted-foreground',
  unknown: 'text-muted-foreground',
};

export function PhaseMotif({ cyclePhase }: { cyclePhase: CyclePhase }) {
  const prefersReducedMotion = useReducedMotion();
  const colorClass = PHASE_COLOR_CLASS[cyclePhase];

  return (
    <div className={`relative mx-auto mb-flow-4 flex size-16 items-center justify-center ${colorClass}`} aria-hidden="true">
      <motion.div
        className="absolute size-16 rounded-full bg-current opacity-20 blur-lg"
        animate={prefersReducedMotion ? undefined : { opacity: [0.15, 0.3, 0.15], scale: [1, 1.15, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.svg
        viewBox="0 0 24 24"
        fill="none"
        className="relative size-9"
        animate={prefersReducedMotion ? undefined : { scale: [1, 1.06, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36A5.4 5.4 0 0 1 12 3z" fill="currentColor" />
      </motion.svg>
    </div>
  );
}
