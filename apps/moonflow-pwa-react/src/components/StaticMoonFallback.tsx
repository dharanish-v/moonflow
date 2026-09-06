// src/components/StaticMoonFallback.tsx — 2D moon-phase illustration, ported
// from moon-phase.js's renderMoonPhaseSVG as real JSX (an offset-circle
// clip, not a precise terminator ellipse — stylized, not scientific). This
// is Home's real, load-bearing rendering until Phase 5 adds MoonPhase3D on
// top of it additively; it stays afterward as the reduced-motion/no-WebGL
// fallback.
//
// Purely decorative (aria-hidden) — same as MoonPhase3D's Canvas — so
// whichever one renders, the accessible phase description always comes
// from Home's own single sr-only label, never duplicated between the two.
import { motion } from 'framer-motion';
import { illuminationFraction } from '../lib/moon-phase';

// Plays its one-time fade-and-scale-in on first mount of the session only,
// never on every remount (e.g. tab-switching back to Home) — same rule
// home.js enforced with its own module-level flag.
let hasAnimatedThisSession = false;

export interface StaticMoonFallbackProps {
  phase: number;
  size?: number;
}

export function StaticMoonFallback({ phase, size = 150 }: StaticMoonFallbackProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.387;
  const k = illuminationFraction(phase);
  const maxOffset = r * 2.1;
  const offset = phase < 0.5 ? -maxOffset * k : maxOffset * k;
  const clipId = `moon-clip-${Math.round(phase * 1000)}`;

  const shouldAnimate = !hasAnimatedThisSession;
  hasAnimatedThisSession = true;

  return (
    <motion.svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className="mx-auto block"
      aria-hidden="true"
      initial={shouldAnimate ? { opacity: 0, scale: 0.85 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <defs>
        <pattern id="moon-grain" width={6} height={6} patternUnits="userSpaceOnUse">
          <circle cx={1} cy={1} r={0.6} fill="var(--bg-screen)" opacity={0.35} />
        </pattern>
        <clipPath id={clipId}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill="var(--moon-unlit)" />
      <g clipPath={`url(#${clipId})`}>
        <circle cx={cx + offset} cy={cy} r={r} fill="var(--accent-gold)" />
        <circle cx={cx + offset} cy={cy} r={r} fill="url(#moon-grain)" />
      </g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border-muted)" strokeWidth={1} />
    </motion.svg>
  );
}
