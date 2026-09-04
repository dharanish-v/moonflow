// @ts-check
// screens/insights.js — see "Insights" in moonflow-design-system.md, including the
// "not enough history yet" empty state.

import { ICONS } from '../icons.js';
import { SYMPTOM_OPTIONS } from '../constants.js';
import { derivePeriods, diffDays } from '../cycle-math.js';

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

  const body = data.hasEnoughHistory ? `
    <div class="card-grid">
      <div class="card"><div class="card__label">Avg cycle</div><div class="card__value">${data.avgCycleLength} days</div></div>
      <div class="card"><div class="card__label">Avg period</div><div class="card__value">${data.avgPeriodLength} days</div></div>
      <div class="card"><div class="card__label">Variability</div><div class="card__value">&plusmn;${data.variability} days</div></div>
      <div class="card"><div class="card__label">Cycles logged</div><div class="card__value">${data.cyclesLogged}</div></div>
    </div>

    <div class="section-label">Cycle length, last ${data.recentCycleLengths.length} cycles</div>
    <div class="bar-chart">
      ${data.recentCycleLengths.map(len => `<div class="bar-chart__bar" style="height:${Math.max(8, (len - 20) * 4)}px"></div>`).join('')}
    </div>
    <div class="bar-chart__labels">${data.recentCycleLengths.map(len => `<span>${len}</span>`).join('')}</div>

    ${data.topSymptoms.length ? `
      <div class="section-label">Most logged symptoms</div>
      ${data.topSymptoms.map(s => `
        <div class="freq-row">
          <div class="freq-row__top"><span>${s.label}</span><span>${s.percent}%</span></div>
          <div class="freq-row__track"><div class="freq-row__fill" style="width:${s.percent}%"></div></div>
        </div>
      `).join('')}
    ` : ''}
  ` : `
    <p class="screen__subtitle" style="margin-top: var(--space-6);">Not enough history yet — check back after your next cycle</p>
  `;

  return `
    <div class="screen">
      <h1 class="screen__title" style="text-align:left; margin-bottom: var(--space-4);">Insights</h1>
      ${body}
    </div>
  `;
}

// insights.js has no interactive elements of its own beyond what the global
// tab bar (in index.html, per ADR-017) already handles — no mount function needed.
