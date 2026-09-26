// src/lib/perimenopause.ts — T91. Gentle staging hints from the STRAW+10
// criteria (Harlow et al., 2012), never a diagnosis:
//   early menopausal transition — a persistent difference of 7+ days in the
//     length of consecutive cycles (recurring within 10 cycles);
//   late transition — an interval of 60+ days without a period;
//   final period likely passed — 12 months without a period.
// And the one red flag worth surfacing: any bleeding after 12 months
// without a period (postmenopausal bleeding should be checked).
import { derivePeriods, diffDays, formatDate } from './cycle-math';
import type { HealthNudge } from './health-nudges';
import type { Entry, Settings } from './types';

export type PerimenopauseStage = 'early-transition' | 'late-transition' | 'postmenopause-possible';

const BLEEDING = new Set(['spotting', 'light', 'medium', 'heavy']);
const YEAR = 365;

export function perimenopauseStage(entries: Array<Pick<Entry, 'date' | 'flow'>>, today: Date = new Date()): PerimenopauseStage | null {
  const todayStr = formatDate(today);
  const starts = derivePeriods(entries).map((p) => p.start);
  if (!starts.length) return null;
  if (diffDays(starts.at(-1)!, todayStr) >= YEAR) return 'postmenopause-possible';

  const gaps = starts.slice(1).map((s, i) => diffDays(starts[i]!, s));
  if (gaps.some((g) => g >= 60)) return 'late-transition';

  const recent = gaps.slice(-10);
  const bigSwings = recent.slice(1).filter((g, i) => Math.abs(g - recent[i]!) >= 7).length;
  return bigSwings >= 2 ? 'early-transition' : null;
}

export const STAGE_TEXT: Record<PerimenopauseStage, { title: string; body: string }> = {
  'early-transition': {
    title: 'Your cycles are changing length',
    body: 'Cycles that swing by a week or more from one to the next are common in the early menopausal transition.',
  },
  'late-transition': {
    title: "You've had a gap of two months or more",
    body: 'Gaps of 60 days or more between periods are typical of the later menopausal transition.',
  },
  'postmenopause-possible': {
    title: 'No period for 12 months',
    body: 'Twelve months without a period usually means the final period has passed (menopause).',
  },
};

export function suggestPerimenopauseMode(
  entries: Array<Pick<Entry, 'date' | 'flow'>>,
  settings: Pick<Settings, 'birthYear' | 'perimenopauseMode'>,
  today: Date = new Date(),
): boolean {
  if (settings.perimenopauseMode || !settings.birthYear) return false;
  return today.getFullYear() - settings.birthYear >= 40 && perimenopauseStage(entries, today) !== null;
}

export function menopauseNudges(entries: Array<Pick<Entry, 'date' | 'flow'>>, today: Date = new Date()): HealthNudge[] {
  void today;
  const bleeding = entries.filter((e) => e.flow && BLEEDING.has(e.flow)).map((e) => e.date).sort();
  const late = bleeding.find((d, i) => i > 0 && diffDays(bleeding[i - 1]!, d) >= YEAR);
  if (!late) return [];
  return [
    {
      id: 'postmenopausal-bleeding' as HealthNudge['id'],
      title: 'Bleeding after a year without periods',
      body: 'Any bleeding more than 12 months after your last period is worth checking with a doctor or clinician soon. This is not a diagnosis — it is usually nothing serious, but it should be looked at.',
    },
  ];
}
