// src/lib/quotes.ts — Home's "quote of the day." Deterministic by calendar
// day (not random per render/reload) so it doesn't flicker between two
// different lines if the user backgrounds and reopens the app the same day.
// Filtered by cyclePhase first (period/follicular/fertile/luteal each get
// their own tone), falling back to the phase-neutral pool when a phase has
// no match or cyclePhase is 'unknown'.
import type { CyclePhase } from './home-status';

interface Quote {
  text: string;
  phase?: Exclude<CyclePhase, 'unknown'>;
}

const QUOTES: Quote[] = [
  { text: 'Rest is productive too.', phase: 'period' },
  { text: 'Be gentle with yourself today.', phase: 'period' },
  { text: "Slowing down isn't falling behind.", phase: 'period' },
  { text: 'Your body is doing quiet, important work right now.', phase: 'period' },
  { text: 'A new cycle, a clean page.', phase: 'follicular' },
  { text: "Energy's building — no need to rush it.", phase: 'follicular' },
  { text: 'Small starts count.', phase: 'follicular' },
  { text: 'Curiosity is a good place to begin.', phase: 'follicular' },
  { text: "You're at your brightest right now — use it well.", phase: 'fertile' },
  { text: 'Confidence looks good on you today.', phase: 'fertile' },
  { text: 'A good day to say the bold thing.', phase: 'fertile' },
  { text: 'Momentum is on your side.', phase: 'fertile' },
  { text: 'Steadiness is its own kind of strength.', phase: 'luteal' },
  { text: "It's okay to want fewer plans this week.", phase: 'luteal' },
  { text: 'Finishing well matters more than starting fast.', phase: 'luteal' },
  { text: 'Give yourself the same patience you give others.', phase: 'luteal' },
  { text: 'Your rhythm is yours — no one else keeps it.' },
  { text: 'Notice one thing your body did well today.' },
  { text: 'Tracking is care, not correction.' },
  { text: 'Every cycle teaches you something new about yourself.' },
];

const PHASE_NEUTRAL_QUOTES = QUOTES.filter((q) => !q.phase);

/** Day-of-year (1-366), used to pick deterministically without a Date lib. */
function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000);
}

export function quoteOfTheDay(cyclePhase: CyclePhase, today: Date = new Date()): string {
  const pool = cyclePhase === 'unknown' ? PHASE_NEUTRAL_QUOTES : QUOTES.filter((q) => q.phase === cyclePhase);
  const source = pool.length > 0 ? pool : PHASE_NEUTRAL_QUOTES;
  const index = dayOfYear(today) % source.length;
  return source[index]!.text;
}
