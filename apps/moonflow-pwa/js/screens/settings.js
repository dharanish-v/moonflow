// @ts-check
// screens/settings.js — see "Settings" in moonflow-design-system.md and ADR-011
// (discreet icon is an install-time choice, not a live toggle here).

import { ICONS } from '../icons.js';

const LIST_ROW = 'list-row flex items-center justify-between py-flow-4 border-b-[0.5px] border-border-hairline last:border-b-0';
const LIST_ROW_BUTTON = `${LIST_ROW} w-full bg-transparent border-0 font-[inherit] text-ink cursor-pointer`;
const LIST_ROW_LEFT = 'flex items-center gap-flow-3 [&>svg]:w-4 [&>svg]:h-4 [&>svg]:text-ink-muted';
const LIST_ROW_LABEL = 'text-flow-body text-ink';
const LIST_ROW_RIGHT = 'flex items-center gap-flow-1';
const LIST_ROW_VALUE = 'text-flow-body text-ink-muted';

/** @param {boolean} on */
function toggleTrackClasses(on) {
  const base = 'toggle w-[3.1875rem] h-[1.9375rem] rounded-[0.96875rem] relative border-0 cursor-pointer p-0 transition-[background-color] duration-150 ease-[ease]';
  return on ? `${base} toggle--on bg-accent-gold` : `${base} bg-border-muted`;
}
/** @param {boolean} on */
function toggleKnobClasses(on) {
  const base = 'toggle__knob w-[1.6875rem] h-[1.6875rem] rounded-full bg-bg-frame absolute top-[0.125rem] left-[0.125rem] transition-transform duration-150 ease-[ease]';
  return on ? `${base} translate-x-[1.25rem]` : base;
}

/**
 * @param {{pinLockEnabled: boolean, avgCycleLength: number, avgPeriodLength: number}} settings
 */
export function renderSettingsScreen(settings) {
  return `
    <div class="flex-1 flex flex-col w-full max-w-[26rem] mx-auto box-border py-flow-6 px-flow-5">
      <h1 class="text-flow-title font-medium text-ink text-left mb-flow-4">Settings</h1>

      <div class="${LIST_ROW}">
        <div class="${LIST_ROW_LEFT}">${ICONS.lock}<span class="${LIST_ROW_LABEL}">App lock</span></div>
        <button type="button" class="${toggleTrackClasses(settings.pinLockEnabled)}" id="toggle-pin" role="switch" aria-checked="${settings.pinLockEnabled}" aria-label="App lock"><span class="${toggleKnobClasses(settings.pinLockEnabled)}"></span></button>
      </div>

      <div class="${LIST_ROW}">
        <div class="${LIST_ROW_LEFT}">${ICONS.bell}<span class="${LIST_ROW_LABEL}">Reminders</span></div>
        <button type="button" class="${toggleTrackClasses(false)}" id="toggle-reminders" role="switch" aria-checked="false" aria-label="Reminders" disabled title="Coming in V2"><span class="${toggleKnobClasses(false)}"></span></button>
      </div>

      <button type="button" class="${LIST_ROW_BUTTON}" id="row-cycle-length" aria-label="Average cycle length, ${settings.avgCycleLength} days">
        <div class="${LIST_ROW_LEFT}">${ICONS.calendar}<span class="${LIST_ROW_LABEL}">Average cycle length</span></div>
        <div class="${LIST_ROW_RIGHT}"><span class="${LIST_ROW_VALUE}">${settings.avgCycleLength} days</span>${ICONS['chevron-right']}</div>
      </button>

      <button type="button" class="${LIST_ROW_BUTTON}" id="row-period-length" aria-label="Average period length, ${settings.avgPeriodLength} days">
        <div class="${LIST_ROW_LEFT}">${ICONS.droplet}<span class="${LIST_ROW_LABEL}">Average period length</span></div>
        <div class="${LIST_ROW_RIGHT}"><span class="${LIST_ROW_VALUE}">${settings.avgPeriodLength} days</span>${ICONS['chevron-right']}</div>
      </button>

      <button type="button" class="${LIST_ROW_BUTTON}" id="row-discreet-icon" aria-label="Discreet icon" aria-expanded="false">
        <div class="${LIST_ROW_LEFT}">${ICONS['eye-off']}<span class="${LIST_ROW_LABEL}">Discreet icon</span></div>
        <div class="${LIST_ROW_RIGHT}">${ICONS['chevron-right']}</div>
      </button>

      <button type="button" class="${LIST_ROW_BUTTON}" id="export-data" aria-label="Export data">
        <div class="${LIST_ROW_LEFT}">${ICONS.download}<span class="${LIST_ROW_LABEL}">Export data</span></div>
        <div class="${LIST_ROW_RIGHT}">${ICONS['chevron-right']}</div>
      </button>

      <p id="discreet-explainer" class="hidden text-flow-micro text-ink-muted mt-flow-2">To switch to a discreet home screen icon, remove Moonflow from your home screen and reinstall using the alternate link.</p>
    </div>
  `;
}

/**
 * @param {HTMLElement} container
 * @param {{
 *   onTogglePinLock: (enabled: boolean) => void,
 *   onEditCycleLength: () => void,
 *   onEditPeriodLength: () => void,
 *   onExport: () => void
 * }} handlers
 */
export function mountSettingsScreen(container, { onTogglePinLock, onEditCycleLength, onEditPeriodLength, onExport }) {
  const pinToggle = /** @type {HTMLButtonElement} */ (container.querySelector('#toggle-pin'));
  pinToggle.addEventListener('click', () => {
    const nowOn = !pinToggle.classList.contains('toggle--on');
    pinToggle.className = toggleTrackClasses(nowOn);
    const knob = pinToggle.querySelector('.toggle__knob');
    if (knob) knob.className = toggleKnobClasses(nowOn);
    pinToggle.setAttribute('aria-checked', String(nowOn));
    onTogglePinLock(nowOn);
  });

  const explainer = container.querySelector('#discreet-explainer');
  const discreetRow = container.querySelector('#row-discreet-icon');
  discreetRow.addEventListener('click', () => {
    const nowOpen = explainer.classList.contains('hidden');
    explainer.classList.toggle('hidden', !nowOpen);
    discreetRow.setAttribute('aria-expanded', String(nowOpen));
  });

  container.querySelector('#row-cycle-length').addEventListener('click', onEditCycleLength);
  container.querySelector('#row-period-length').addEventListener('click', onEditPeriodLength);

  container.querySelector('#export-data').addEventListener('click', onExport);
}
