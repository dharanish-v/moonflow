// @ts-check
// screens/onboarding.js — first-run setup only. See "Onboarding (first run only)"
// in moonflow-design-system.md and the Onboarding row in moonflow-copy-deck.md.

import { ICONS } from '../icons.js';

const MIN_CYCLE_LENGTH = 15;
const MAX_CYCLE_LENGTH = 45;
const MIN_PERIOD_LENGTH = 1;
const MAX_PERIOD_LENGTH = 14;
const DEFAULT_CYCLE_LENGTH = 28;
const DEFAULT_PERIOD_LENGTH = 5;

function todayString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function renderOnboardingScreen() {
  return `
    <div class="flex-1 flex flex-col w-full max-w-[26rem] mx-auto box-border py-flow-6 px-flow-5 justify-center">
      <div class="screen__icon w-[2.75rem] h-[2.75rem] rounded-full bg-fertile-tint text-accent-gold flex items-center justify-center mx-auto mb-flow-4">${ICONS.moon}</div>
      <h1 class="text-flow-title font-medium text-ink text-center mb-flow-1">Let's set up Moonflow</h1>
      <p class="screen__subtitle text-flow-caption text-ink-muted text-center mb-flow-6">Just enough to make your first prediction</p>

      <div class="mb-flow-6">
        <label class="block text-flow-caption text-ink-muted mb-flow-2" for="onboarding-date">When did your last period start?</label>
        <input type="date" id="onboarding-date" class="w-full box-border min-h-[2.75rem] bg-surface-card border-[0.5px] border-border-muted rounded-flow-pill py-flow-3 px-flow-4 text-flow-body text-ink font-[inherit] [color-scheme:dark]" max="${todayString()}">
      </div>

      <div class="mb-flow-6">
        <span class="block text-flow-caption text-ink-muted mb-flow-2" id="cycle-length-label">Average cycle length</span>
        <div class="flex items-center justify-between bg-surface-card border-[0.5px] border-border-muted rounded-flow-pill py-flow-3 px-flow-4" role="group" aria-labelledby="cycle-length-label">
          <button type="button" class="w-[2.75rem] h-[2.75rem] rounded-full border-[0.5px] border-border-muted bg-transparent text-ink-muted text-flow-body leading-none flex items-center justify-center cursor-pointer font-[inherit] p-0 transition-transform duration-100 ease-[ease] active:scale-[0.9]" data-stepper-action="cycle-dec" aria-label="Decrease average cycle length">&minus;</button>
          <span class="text-flow-body text-ink" id="cycle-length-value">${DEFAULT_CYCLE_LENGTH} days</span>
          <button type="button" class="w-[2.75rem] h-[2.75rem] rounded-full border-[0.5px] border-border-muted bg-transparent text-ink-muted text-flow-body leading-none flex items-center justify-center cursor-pointer font-[inherit] p-0 transition-transform duration-100 ease-[ease] active:scale-[0.9]" data-stepper-action="cycle-inc" aria-label="Increase average cycle length">+</button>
        </div>
      </div>

      <div class="mb-flow-6">
        <span class="block text-flow-caption text-ink-muted mb-flow-2" id="period-length-label">Average period length</span>
        <div class="flex items-center justify-between bg-surface-card border-[0.5px] border-border-muted rounded-flow-pill py-flow-3 px-flow-4" role="group" aria-labelledby="period-length-label">
          <button type="button" class="w-[2.75rem] h-[2.75rem] rounded-full border-[0.5px] border-border-muted bg-transparent text-ink-muted text-flow-body leading-none flex items-center justify-center cursor-pointer font-[inherit] p-0 transition-transform duration-100 ease-[ease] active:scale-[0.9]" data-stepper-action="period-dec" aria-label="Decrease average period length">&minus;</button>
          <span class="text-flow-body text-ink" id="period-length-value">${DEFAULT_PERIOD_LENGTH} days</span>
          <button type="button" class="w-[2.75rem] h-[2.75rem] rounded-full border-[0.5px] border-border-muted bg-transparent text-ink-muted text-flow-body leading-none flex items-center justify-center cursor-pointer font-[inherit] p-0 transition-transform duration-100 ease-[ease] active:scale-[0.9]" data-stepper-action="period-inc" aria-label="Increase average period length">+</button>
        </div>
      </div>

      <button type="button" class="flex items-center justify-center w-full min-h-[2.75rem] box-border py-flow-3 px-flow-5 rounded-flow-card border-0 text-flow-nav font-medium text-center cursor-pointer font-[inherit] transition-transform duration-100 ease-[ease] active:scale-[0.97] bg-accent-gold text-accent-gold-text disabled:opacity-40 disabled:cursor-not-allowed" id="onboarding-submit" disabled>Get started</button>
    </div>
  `;
}

/**
 * Wires up interactivity after renderOnboardingScreen()'s HTML is inserted —
 * see the "screen-level render vs. targeted update" split in ADR-007.
 * @param {HTMLElement} container
 * @param {(data: {lastPeriodStart: string, avgCycleLength: number, avgPeriodLength: number}) => void} onComplete
 */
export function mountOnboardingScreen(container, onComplete) {
  let cycleLength = DEFAULT_CYCLE_LENGTH;
  let periodLength = DEFAULT_PERIOD_LENGTH;

  const dateInput = /** @type {HTMLInputElement} */ (container.querySelector('#onboarding-date'));
  const cycleValueEl = /** @type {HTMLElement} */ (container.querySelector('#cycle-length-value'));
  const periodValueEl = /** @type {HTMLElement} */ (container.querySelector('#period-length-value'));
  const submitButton = /** @type {HTMLButtonElement} */ (container.querySelector('#onboarding-submit'));

  dateInput.addEventListener('change', () => {
    submitButton.disabled = !dateInput.value;
  });

  const dec = (/** @type {string} */ action, /** @type {() => void} */ fn) =>
    container.querySelector(`[data-stepper-action="${action}"]`).addEventListener('click', fn);

  dec('cycle-dec', () => {
    cycleLength = Math.max(MIN_CYCLE_LENGTH, cycleLength - 1);
    cycleValueEl.textContent = `${cycleLength} days`;
  });
  dec('cycle-inc', () => {
    cycleLength = Math.min(MAX_CYCLE_LENGTH, cycleLength + 1);
    cycleValueEl.textContent = `${cycleLength} days`;
  });
  dec('period-dec', () => {
    periodLength = Math.max(MIN_PERIOD_LENGTH, periodLength - 1);
    periodValueEl.textContent = `${periodLength} days`;
  });
  dec('period-inc', () => {
    periodLength = Math.min(MAX_PERIOD_LENGTH, periodLength + 1);
    periodValueEl.textContent = `${periodLength} days`;
  });

  submitButton.addEventListener('click', () => {
    if (!dateInput.value) return;
    onComplete({
      lastPeriodStart: dateInput.value,
      avgCycleLength: cycleLength,
      avgPeriodLength: periodLength
    });
  });
}
