// @ts-check
// screens/insights.js — see "Insights" in moonflow-design-system.md, including the
// "not enough history yet" empty state.

import gsap from 'gsap';
import { ICONS } from '../icons.js';
import { SYMPTOM_OPTIONS } from '../constants.js';
import { derivePeriods, diffDays } from '../cycle-math.js';
import { prefersReducedMotion } from '../motion.js';

/** @param {number[]} numbers */
function median(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** @param {number[]} numbers */
function stdDev(numbers) {
  const avg = numbers.reduce((s, n) => s + n, 0) / numbers.length;
  return Math.sqrt(numbers.reduce((s, n) => s + (n - avg) ** 2, 0) / numbers.length);
}

/**
 * @param {Array<{date: string, flow: string|null, symptoms?: string[]}>} entries
 */
export function computeInsights(entries) {
  const periods = derivePeriods(entries);
  const hasEnoughHistory = periods.length >= 2;

  const cycleLengths = [];
  for (let i = 1; i < periods.length; i++) cycleLengths.push(diffDays(periods[i - 1].start, periods[i].start));
  const periodLengths = periods.map(p => diffDays(p.start, p.end) + 1);

  const symptomCounts = /** @type {Record<string, number>} */ ({});
  let daysWithAnyLog = 0;
  entries.forEach(e => {
    if (e.symptoms && e.symptoms.length) daysWithAnyLog++;
    (e.symptoms || []).forEach(s => { symptomCounts[s] = (symptomCounts[s] || 0) + 1; });
  });

  const topSymptoms = Object.entries(symptomCounts)
    .map(([id, count]) => ({
      id,
      label: SYMPTOM_OPTIONS.find(s => s.id === id)?.label ?? id,
      percent: daysWithAnyLog > 0 ? Math.round((count / daysWithAnyLog) * 100) : 0
    }))
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 3);

  return {
    hasEnoughHistory,
    avgCycleLength: hasEnoughHistory ? Math.round(median(cycleLengths)) : null,
    avgPeriodLength: periodLengths.length ? Math.round(median(periodLengths)) : null,
    variability: hasEnoughHistory ? Math.round(stdDev(cycleLengths)) : null,
    cyclesLogged: periods.length,
    recentCycleLengths: cycleLengths.slice(-6),
    topSymptoms
  };
}

/**
 * @param {Array<{date: string, flow: string|null, symptoms?: string[]}>} entries
 */
export function renderInsightsScreen(entries) {
  const data = computeInsights(entries);

  // Empty state matches the onboarding/PIN-lock centered icon+title+subtitle
  // composition — a bare heading pinned to the top with nothing else on the
  // screen read as unfinished, not as "deliberately calm."
  if (!data.hasEnoughHistory) {
    return `
      <div class="flex-1 flex flex-col w-full max-w-[26rem] mx-auto box-border py-flow-6 px-flow-5 justify-center">
        <div class="screen__icon w-11 h-11 rounded-full bg-primary/15 text-primary flex items-center justify-center mx-auto mb-flow-4">${ICONS['chart-bar'].replace('<svg ', '<svg class="w-5 h-5" ')}</div>
        <h1 class="text-flow-title font-medium text-base-content text-center mb-flow-1">Insights</h1>
        <p class="screen__subtitle text-flow-caption text-base-content/60 text-center">Not enough history yet — check back after your next cycle</p>
      </div>
    `;
  }

  const stat = (title, value) => `
    <div class="stat bg-base-200 rounded-box p-0 py-flow-3 px-flow-4">
      <div class="stat-title text-flow-micro text-base-content/60">${title}</div>
      <div class="stat-value text-flow-stat font-medium text-base-content mt-flow-1">${value}</div>
    </div>
  `;

  return `
    <div class="flex-1 flex flex-col w-full max-w-[26rem] mx-auto box-border py-flow-6 px-flow-5">
      <h1 class="text-flow-title font-medium text-base-content text-left mb-flow-4">Insights</h1>
      <div class="flex-1 flex flex-col justify-center">
        <!-- Avg cycle gets its own larger row — the single number someone
             actually glances at daily — instead of 4 identically-sized
             tiles (the same-size-card grid every stats screen defaults to,
             which flattens "the number I check" and "the number I don't"
             to equal visual weight). -->
        <div class="stat bg-base-200 rounded-box p-0 py-flow-4 px-flow-4 mb-flow-3">
          <div class="stat-title text-flow-caption text-base-content/60">Avg cycle</div>
          <div class="stat-value text-flow-hero font-bold text-primary mt-flow-1">${data.avgCycleLength} days</div>
        </div>
        <div class="grid grid-cols-3 gap-flow-3">
          ${stat('Avg period', `${data.avgPeriodLength}d`)}
          ${stat('Variability', `&plusmn;${data.variability}d`)}
          ${stat('Logged', data.cyclesLogged)}
        </div>

        <div class="text-flow-caption text-base-content/60 mt-flow-6 mb-flow-3">Cycle length, last ${data.recentCycleLengths.length} cycles</div>
        <div class="flex items-end gap-flow-3 h-16">
          ${data.recentCycleLengths.map(len => `<div class="bar-chart__bar flex-1 bg-primary rounded-t-[0.25rem]" style="height:${Math.max(8, (len - 20) * 4)}px"></div>`).join('')}
        </div>
        <div class="flex gap-flow-3 mt-flow-1">${data.recentCycleLengths.map(len => `<span class="flex-1 text-center text-flow-micro text-base-content/40">${len}</span>`).join('')}</div>

        ${data.topSymptoms.length ? `
          <div class="text-flow-caption text-base-content/60 mt-flow-6 mb-flow-3">Most logged symptoms</div>
          ${data.topSymptoms.map(s => `
            <div class="mb-flow-3">
              <div class="flex justify-between text-flow-caption text-base-content/80 mb-flow-1"><span>${s.label}</span><span>${s.percent}%</span></div>
              <progress class="freq-row__fill progress progress-accent w-full h-[0.375rem]" value="0" max="100" data-target="${s.percent}"></progress>
            </div>
          `).join('')}
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * insights.js has no interactive elements of its own beyond what the global
 * tab bar (in index.html, per ADR-017) already handles — this mount exists
 * purely for the bar/fill grow-in below (the data-populated view previously
 * had zero entrance animation at all: bars and symptom-frequency fills just
 * appeared instantly at their final size). A no-op on the empty state or a
 * history with no logged symptoms — the querySelectorAll calls just find
 * nothing to animate.
 * @param {HTMLElement} container
 */
export function mountInsightsScreen(container) {
  const bars = container.querySelectorAll('.bar-chart__bar');
  const fills = /** @type {NodeListOf<HTMLProgressElement>} */ (container.querySelectorAll('.freq-row__fill'));

  if (prefersReducedMotion()) {
    fills.forEach(el => { el.value = Number(el.dataset.target); });
    return;
  }

  if (bars.length) gsap.from(bars, { height: 0, duration: 0.4, ease: 'power2.out', stagger: 0.05 });
  fills.forEach((el, i) => {
    const target = Number(el.dataset.target);
    const proxy = { value: 0 };
    gsap.to(proxy, {
      value: target,
      duration: 0.5,
      ease: 'power2.out',
      delay: bars.length * 0.05 + i * 0.08,
      onUpdate: () => { el.value = proxy.value; }
    });
  });
}
