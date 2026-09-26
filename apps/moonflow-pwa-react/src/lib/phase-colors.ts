// src/lib/phase-colors.ts — one phase → colour mapping shared by the moon
// motif and Home's ambient wash, so they can never drift apart.
import type { CyclePhase } from './home-status';

export const PHASE_COLOR_CLASS: Record<CyclePhase, string> = {
  period: 'text-secondary',
  follicular: 'text-accent',
  fertile: 'text-primary',
  luteal: 'text-muted-foreground',
  unknown: 'text-muted-foreground',
};

