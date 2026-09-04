// @ts-check
// moon-phase.js — the actual current lunar phase, per ADR-019. This is deliberately
// separate from cycle-math.js: it computes a real astronomical approximation, not a
// cycle-day prediction. Accurate to within about a day — plenty for an illustration,
// not intended for scientific use.

const SYNODIC_MONTH_DAYS = 29.530588853;
const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14); // a known new moon reference instant

/**
 * @param {Date} date
 * @returns {number} 0 = new moon, 0.5 = full moon, approaching 1 = new moon again
 */
export function getMoonPhase(date) {
  const daysSince = (date.getTime() - KNOWN_NEW_MOON_MS) / 86400000;
  const phase = daysSince / SYNODIC_MONTH_DAYS;
  return ((phase % 1) + 1) % 1; // normalize into [0, 1)
}

/** @param {number} phase */
export function illuminationFraction(phase) {
  return (1 - Math.cos(2 * Math.PI * phase)) / 2; // 0 at new, 1 at full
}

/** @param {number} phase */
export function moonPhaseLabel(phase) {
  if (phase < 0.03 || phase > 0.97) return 'new moon';
  if (phase < 0.22) return 'waxing crescent';
  if (phase < 0.28) return 'first quarter';
  if (phase < 0.47) return 'waxing gibbous';
  if (phase < 0.53) return 'full moon';
  if (phase < 0.72) return 'waning gibbous';
  if (phase < 0.78) return 'last quarter';
  return 'waning crescent';
}

/**
 * Renders the moon-phase illustration as an SVG string, using the offset-circle
 * technique from the design system (a lit circle with a dark circle sliding across
 * it), not a precise terminator-ellipse path — stylized, not scientific.
 * @param {number} phase
 * @param {number} [size] viewBox size in px
 */
export function renderMoonPhaseSVG(phase, size = 150) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.387; // matches the proportions used in the earlier mockup
  const k = illuminationFraction(phase);
  const maxOffset = r * 2.1;
  const offset = phase < 0.5 ? -maxOffset * k : maxOffset * k;
  const clipId = `moon-clip-${Math.round(phase * 1000)}`;

  return `
    <svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${moonPhaseLabel(phase)}">
      <defs>
        <pattern id="moon-grain" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.6" fill="var(--bg-screen)" opacity="0.35"/>
        </pattern>
        <clipPath id="${clipId}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
      </defs>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--moon-unlit)"/>
      <g clip-path="url(#${clipId})">
        <circle cx="${cx + offset}" cy="${cy}" r="${r}" fill="var(--accent-gold)"/>
        <circle cx="${cx + offset}" cy="${cy}" r="${r}" fill="url(#moon-grain)"/>
      </g>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--border-muted)" stroke-width="1"/>
    </svg>
  `;
}
