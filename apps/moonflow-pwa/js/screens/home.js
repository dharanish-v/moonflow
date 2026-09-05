// @ts-check
// screens/home.js — the main hub. See "Home" in moonflow-design-system.md and ADR-019.

import gsap from 'gsap';
import { ICONS } from '../icons.js';
import { renderMoonPhaseSVG, getMoonPhase, moonPhaseLabel } from '../moon-phase.js';
import { derivePeriods, predictNextPeriod, estimateFertileWindow, diffDays } from '../cycle-math.js';
import { prefersReducedMotion } from '../motion.js';

/** @param {Date} date */
function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Tracks whether the moon-phase illustration has already played its one-time
// fade-and-scale-in this session — it must animate on first load only, never
// on every re-render (design-system.md edge-case rules). GSAP-driven
// (mountHomeScreen), not a CSS class — see motion.js.
let hasAnimatedMoonPhaseThisSession = false;

// Set by renderHomeScreen just before it flips the flag above, read once by
// the very next mountHomeScreen call — this is what lets mount (the only
// place with a real DOM node to hand GSAP) know whether *this* render is the
// one that should animate, since the flag itself is always true afterward.
let shouldAnimateMoonPhaseOnNextMount = false;

/**
 * Pure: decides the animation class for a given prior-animated state — kept
 * separate from the mutable session flag above so it's unit-testable.
 * @param {boolean} alreadyAnimated
 */
export function getMoonPhaseAnimationClass(alreadyAnimated) {
  return alreadyAnimated ? '' : ' moon-phase--animate-in';
}

/**
 * Computes everything the home screen needs to display, from raw entries + settings.
 * Exported separately from the render function so it's independently testable.
 * @param {Array<{date: string, flow: string|null}>} entries
 * @param {{avgCycleLength: number, lastPeriodStart: string|null}} settings
 * @param {Date} [today]
 */
export function computeHomeStatus(entries, settings, today = new Date()) {
  const todayStr = toDateString(today);
  const periods = derivePeriods(entries);
  const mostRecentStart = periods.length > 0 ? periods[periods.length - 1].start : settings.lastPeriodStart;
  const mostRecentEnd = periods.length > 0 ? periods[periods.length - 1].end : null;

  const cycleDay = mostRecentStart ? diffDays(mostRecentStart, todayStr) + 1 : null;
  const prediction = predictNextPeriod(periods, settings);
  const isOnPeriod = !!(mostRecentEnd && diffDays(mostRecentStart, todayStr) >= 0 && diffDays(todayStr, mostRecentEnd) >= 0);

  let statusText;
  let isFertile = false;

  if (isOnPeriod) {
    statusText = 'on your period';
  } else if (prediction.confidence !== 'wide' && prediction.date) {
    const fertile = estimateFertileWindow(prediction.date);
    isFertile = diffDays(fertile.start, todayStr) >= 0 && diffDays(todayStr, fertile.end) >= 0;
    const daysToNext = diffDays(todayStr, prediction.date);
    statusText = isFertile
      ? 'fertile window'
      : daysToNext >= 0
        ? `${daysToNext} day${daysToNext === 1 ? '' : 's'} to next period`
        : 'period may be starting soon';
  } else {
    statusText = 'predictions need a bit more history';
  }

  return {
    cycleDay,
    statusText,
    isFertile,
    isEstimated: prediction.confidence === 'estimated',
    moonPhase: getMoonPhase(today)
  };
}

const QUICK_ACTION = 'btn btn-ghost bg-base-200 border-base-300 flex-1 h-auto min-h-0 flex-col gap-flow-2 py-flow-4 px-flow-1';

/**
 * @param {Array<{date: string, flow: string|null}>} entries
 * @param {{avgCycleLength: number, lastPeriodStart: string|null}} settings
 * @param {Date} [today]
 */
export function renderHomeScreen(entries, settings, today = new Date()) {
  const status = computeHomeStatus(entries, settings, today);
  const dayLabel = status.cycleDay !== null ? `Day ${status.cycleDay}` : moonPhaseLabel(status.moonPhase);
  shouldAnimateMoonPhaseOnNextMount = !hasAnimatedMoonPhaseThisSession;
  hasAnimatedMoonPhaseThisSession = true;

  return `
    <div class="flex-1 flex flex-col w-full max-w-[26rem] mx-auto box-border py-flow-6 px-flow-5 justify-center">
      ${renderMoonPhaseSVG(status.moonPhase).replace('<svg ', '<svg class="moon-phase w-[9.375rem] h-[9.375rem] mx-auto block" ')}
      <div class="text-center mt-flow-4">
        <div class="text-flow-title font-medium text-base-content">${dayLabel}</div>
        <div class="text-flow-caption text-base-content/60">${status.statusText}${status.isEstimated ? ' &middot; estimated' : ''}</div>
      </div>
      <div class="text-center text-flow-nav text-base-content/40 tracking-[0.05em] mt-flow-5">பிறை</div>

      <div class="flex gap-flow-3 mt-flow-6">
        <button type="button" class="${QUICK_ACTION}" data-action="flow">
          ${ICONS.droplet.replace('<svg ', '<svg class="w-[1.125rem] h-[1.125rem] text-secondary" ')}
          <span class="text-flow-caption text-base-content/80 font-normal">Flow</span>
        </button>
        <button type="button" class="${QUICK_ACTION}" data-action="mood">
          ${ICONS['mood-smile'].replace('<svg ', '<svg class="w-[1.125rem] h-[1.125rem] text-primary" ')}
          <span class="text-flow-caption text-base-content/80 font-normal">Mood</span>
        </button>
        <button type="button" class="${QUICK_ACTION}" data-action="symptom">
          ${ICONS.notes.replace('<svg ', '<svg class="w-[1.125rem] h-[1.125rem] text-accent" ')}
          <span class="text-flow-caption text-base-content/80 font-normal">Symptom</span>
        </button>
      </div>
    </div>
  `;
}

/**
 * @param {HTMLElement} container
 * @param {{onQuickAction: (kind: 'flow'|'mood'|'symptom') => void}} handlers
 */
export function mountHomeScreen(container, { onQuickAction }) {
  container.querySelectorAll('[data-action]').forEach(el => {
    el.addEventListener('click', () => {
      onQuickAction(/** @type {'flow'|'mood'|'symptom'} */ (el.getAttribute('data-action')));
    });
  });

  if (shouldAnimateMoonPhaseOnNextMount && !prefersReducedMotion()) {
    const moonEl = container.querySelector('.moon-phase');
    if (moonEl) gsap.from(moonEl, { opacity: 0, scale: 0.85, duration: 0.5, ease: 'power2.out' });
  }
  shouldAnimateMoonPhaseOnNextMount = false;
}
