// src/components/StaticMoonFallback.tsx — 2D moon-phase illustration, ported
// from moon-phase.js's renderMoonPhaseSVG as real JSX (an offset-circle
// clip, not a precise terminator ellipse — stylized, not scientific). This
// is Home's real, load-bearing rendering until Phase 5 adds HomeScene on
// top of it additively; it stays afterward as the reduced-motion/no-WebGL2
// fallback (see useRenderMode.ts).
//
// ADR-033 extends it with a static painterly sky behind the moon — a
// gradient wash, a couple of soft cloud blobs, and (dark moods only) a
// handful of star dots, all driven by the same SKY_MOODS table HomeScene
// uses, so the fallback reads as the same scene at a lower fidelity rather
// than a different, unrelated one. Still one static, non-animated SVG — no
// drift/twinkle here regardless of prefers-reduced-motion, since this path
// exists specifically for when motion/WebGL2 isn't available or wanted.
//
// Purely decorative (aria-hidden) — same as HomeScene's Canvas — so
// whichever one renders, the accessible phase description always comes
// from Home's own single sr-only label, never duplicated between the two.
import { motion } from 'framer-motion';
import type { ResolvedTheme } from '../hooks/useResolvedTheme';
import type { CyclePhase } from '../lib/home-status';
import { illuminationFraction } from '../lib/moon-phase';
import { SKY_MOODS } from '../lib/sky-mood';
import { SUN_MOODS } from '../lib/sun-mood';

// Plays its one-time fade-and-scale-in on first mount of the session only,
// never on every remount (e.g. tab-switching back to Home) — same rule
// home.js enforced with its own module-level flag.
let hasAnimatedThisSession = false;

// Fixed, deterministic star positions (not random) — a static illustration
// should render identically every time, unlike HomeScene's live star field.
// Fractional (0–1) so they scale to whatever the real viewBox turns out to be.
const STAR_POSITIONS: ReadonlyArray<readonly [number, number]> = [
  [0.08, 0.08],
  [0.18, 0.2],
  [0.32, 0.05],
  [0.62, 0.06],
  [0.78, 0.16],
  [0.9, 0.1],
  [0.14, 0.32],
  [0.86, 0.28],
  [0.06, 0.55],
  [0.94, 0.6],
  [0.25, 0.72],
  [0.7, 0.78],
];

// A fixed, non-square viewBox (matching the phone-shaped screen it fills via
// preserveAspectRatio="slice" below) — not a 150x150 square like the old
// version, which only worked because the moon used to be the *only* thing
// drawn. Now it's the full background, so it needs to be tall like the
// screen it covers, moon composed in the upper portion with room below for
// Home's own status text/buttons, matching HomeScene's own composition.
const VIEW_W = 300;
const VIEW_H = 500;
const MOON_CY = VIEW_H * 0.28;
const MOON_R = 64;

export interface StaticMoonFallbackProps {
  phase: number;
  cyclePhase: CyclePhase;
  theme: ResolvedTheme;
}

export function StaticMoonFallback({ phase, cyclePhase, theme }: StaticMoonFallbackProps) {
  const cx = VIEW_W / 2;
  const cy = MOON_CY;
  const r = MOON_R;
  const k = illuminationFraction(phase);
  const maxOffset = r * 2.1;
  const offset = phase < 0.5 ? -maxOffset * k : maxOffset * k;
  const clipId = `moon-clip-${Math.round(phase * 1000)}`;
  const isDay = theme === 'light';
  const mood = isDay ? SUN_MOODS[cyclePhase] : SKY_MOODS[cyclePhase];

  const shouldAnimate = !hasAnimatedThisSession;
  hasAnimatedThisSession = true;

  return (
    <motion.svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 -z-10 size-full"
      aria-hidden="true"
      initial={shouldAnimate ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <defs>
        <pattern id="moon-grain" width={6} height={6} patternUnits="userSpaceOnUse">
          <circle cx={1} cy={1} r={0.6} fill="var(--bg-screen)" opacity={0.35} />
        </pattern>
        <clipPath id={clipId}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
        <linearGradient id="sky-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--bg-screen)" />
          <stop offset="55%" stopColor={mood.glowColor} stopOpacity={mood.glowIntensity * 0.6} />
          <stop offset="100%" stopColor="var(--bg-screen)" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="url(#sky-gradient)" />
      {/* Stars only at night — SUN_MOODS' own starOpacity is always 0
          anyway (a day-world never shows stars), but skipping the map
          entirely for isDay avoids rendering a dozen invisible circles. */}
      {!isDay &&
        STAR_POSITIONS.map(([sx, sy], i) => (
          <circle key={i} cx={sx * VIEW_W} cy={sy * VIEW_H} r={2} fill="#ffffff" opacity={mood.starOpacity} />
        ))}
      <ellipse cx={VIEW_W * 0.18} cy={VIEW_H * 0.16} rx={54} ry={16} fill={mood.cloudColor} opacity={mood.cloudOpacity * 0.7} />
      <ellipse cx={VIEW_W * 0.82} cy={VIEW_H * 0.24} rx={46} ry={14} fill={mood.cloudColor} opacity={mood.cloudOpacity * 0.6} />
      <ellipse cx={VIEW_W * 0.28} cy={VIEW_H * 0.4} rx={62} ry={15} fill={mood.cloudColor} opacity={mood.cloudOpacity * 0.45} />
      {isDay ? (
        // The sun doesn't have "phases" (WorldScene's own Sun.tsx avoids
        // inventing a fake one too) — just a plain, fully-lit disc.
        <circle cx={cx} cy={cy} r={r} fill="var(--accent-gold)" />
      ) : (
        <>
          <circle cx={cx} cy={cy} r={r} fill="var(--moon-unlit)" />
          <g clipPath={`url(#${clipId})`}>
            <circle cx={cx + offset} cy={cy} r={r} fill="var(--accent-gold)" />
            <circle cx={cx + offset} cy={cy} r={r} fill="url(#moon-grain)" />
          </g>
        </>
      )}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border-muted)" strokeWidth={1} />
    </motion.svg>
  );
}
