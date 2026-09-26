// src/lib/lunar.ts — today's actual moon phase for Home's illustration
// (design-system.md, ADR-019: "the actual current lunar phase"). Mean
// synodic month from a reference new moon: accurate to within a few hours,
// which is plenty for a picture. Pure arithmetic — no data, no network.

const SYNODIC_DAYS = 29.530588853;
/** New moon, 2000-01-06 18:14 UTC. */
const REFERENCE_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14);
const DAY_MS = 86_400_000;

export interface MoonPhase {
  /** 0 = new … 0.5 = full … 1 = next new. */
  age: number;
  /** Lit fraction of the disc, 0–1. */
  illumination: number;
  waxing: boolean;
  name: string;
}

const NAMES = [
  'New moon',
  'Waxing crescent',
  'First quarter',
  'Waxing gibbous',
  'Full moon',
  'Waning gibbous',
  'Last quarter',
  'Waning crescent',
] as const;

export function moonPhase(date: Date = new Date()): MoonPhase {
  const days = (date.getTime() - REFERENCE_NEW_MOON_MS) / DAY_MS;
  const age = (((days / SYNODIC_DAYS) % 1) + 1) % 1;
  const illumination = (1 - Math.cos(age * 2 * Math.PI)) / 2;
  // Eight named phases, each centred on its moment (new at 0, full at 0.5).
  const name = NAMES[Math.floor((age * 8 + 0.5) % 8)]!;
  return { age, illumination, waxing: age < 0.5, name };
}
