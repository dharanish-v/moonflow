// @ts-check
// screens/home.js — the main hub. See "Home" in moonflow-design-system.md and ADR-019.

import { ICONS } from '../icons.js';
import { renderMoonPhaseSVG, getMoonPhase, moonPhaseLabel } from '../moon-phase.js';
import { derivePeriods, predictNextPeriod, estimateFertileWindow, diffDays } from '../cycle-math.js';

/** @param {Date} date */
function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Tracks whether the moon-phase illustration has already played its one-time
// fade-and-scale-in this session — it must animate on first load only, never
// on every re-render (design-system.md edge-case rules, ADR-015).
let hasAnimatedMoonPhaseThisSession = false;

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

/**
 * @param {Array<{date: string, flow: string|null}>} entries
 * @param {{avgCycleLength: number, lastPeriodStart: string|null}} settings
 * @param {Date} [today]
 */
export function renderHomeScreen(entries, settings, today = new Date()) {
  const status = computeHomeStatus(entries, settings, today);
  const dayLabel = status.cycleDay !== null ? `Day ${status.cycleDay}` : moonPhaseLabel(status.moonPhase);
  const animationClass = getMoonPhaseAnimationClass(hasAnimatedMoonPhaseThisSession);
  hasAnimatedMoonPhaseThisSession = true;

  return `
    <div class="screen">
      ${renderMoonPhaseSVG(status.moonPhase).replace('<svg ', `<svg class="moon-phase${animationClass}" `)}
      <div style="text-align:center; margin-top: var(--space-4);">
        <div class="screen__title" style="margin-bottom:0;">${dayLabel}</div>
        <div class="screen__subtitle" style="margin-bottom:0;">${status.statusText}${status.isEstimated ? ' &middot; estimated' : ''}</div>
      </div>
      <div class="moon-phase__signature">பிறை</div>

      <div class="quick-actions" style="margin-top: var(--space-6);">
        <button type="button" class="quick-action quick-action--flow" data-action="flow">
          ${ICONS.droplet}
          <span class="quick-action__label">Flow</span>
        </button>
        <button type="button" class="quick-action quick-action--mood" data-action="mood">
          ${ICONS['mood-smile']}
          <span class="quick-action__label">Mood</span>
        </button>
        <button type="button" class="quick-action quick-action--symptom" data-action="symptom">
          ${ICONS.notes}
          <span class="quick-action__label">Symptom</span>
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
}
