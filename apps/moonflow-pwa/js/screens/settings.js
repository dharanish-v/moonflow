// @ts-check
// screens/settings.js — see "Settings" in moonflow-design-system.md and ADR-011
// (discreet icon is an install-time choice, not a live toggle here).

import { ICONS } from '../icons.js';

const ROW_LEFT = 'flex items-center gap-flow-3 [&>svg]:w-4 [&>svg]:h-4 [&>svg]:text-base-content/60';
const ROW_LABEL = 'text-flow-body text-base-content';
const ROW_RIGHT = 'flex items-center gap-flow-1';
const ROW_VALUE = 'text-flow-body text-base-content/60';

/**
 * @param {{pinLockEnabled: boolean, avgCycleLength: number, avgPeriodLength: number}} settings
 */
export function renderSettingsScreen(settings) {
  return `
    <div class="flex-1 flex flex-col w-full max-w-[26rem] mx-auto box-border py-flow-6 px-flow-5">
      <h1 class="text-flow-title font-medium text-base-content text-left mb-flow-4">Settings</h1>

      <ul class="list bg-base-200 rounded-box">
        <li class="list-row items-center">
          <div class="list-col-grow ${ROW_LEFT}">${ICONS.lock}<span class="${ROW_LABEL}">App lock</span></div>
          <input type="checkbox" class="toggle toggle-lg toggle-primary" id="toggle-pin" role="switch" ${settings.pinLockEnabled ? 'checked' : ''} aria-label="App lock">
        </li>

        <li class="list-row items-center">
          <div class="list-col-grow ${ROW_LEFT}">${ICONS.bell}<span class="${ROW_LABEL}">Reminders</span></div>
          <input type="checkbox" class="toggle toggle-lg toggle-primary" id="toggle-reminders" role="switch" aria-label="Reminders" disabled title="Coming in V2">
        </li>

        <li class="list-row p-0">
          <button type="button" class="list-col-grow flex items-center justify-between w-full py-4 px-4 bg-transparent border-0 font-[inherit] text-base-content cursor-pointer" id="row-cycle-length" aria-label="Average cycle length, ${settings.avgCycleLength} days">
            <div class="${ROW_LEFT}">${ICONS.calendar}<span class="${ROW_LABEL}">Average cycle length</span></div>
            <div class="${ROW_RIGHT}"><span class="${ROW_VALUE}">${settings.avgCycleLength} days</span>${ICONS['chevron-right']}</div>
          </button>
        </li>

        <li class="list-row p-0">
          <button type="button" class="list-col-grow flex items-center justify-between w-full py-4 px-4 bg-transparent border-0 font-[inherit] text-base-content cursor-pointer" id="row-period-length" aria-label="Average period length, ${settings.avgPeriodLength} days">
            <div class="${ROW_LEFT}">${ICONS.droplet}<span class="${ROW_LABEL}">Average period length</span></div>
            <div class="${ROW_RIGHT}"><span class="${ROW_VALUE}">${settings.avgPeriodLength} days</span>${ICONS['chevron-right']}</div>
          </button>
        </li>

        <li class="list-row p-0">
          <button type="button" class="list-col-grow flex items-center justify-between w-full py-4 px-4 bg-transparent border-0 font-[inherit] text-base-content cursor-pointer" id="row-discreet-icon" aria-label="Discreet icon" aria-expanded="false">
            <div class="${ROW_LEFT}">${ICONS['eye-off']}<span class="${ROW_LABEL}">Discreet icon</span></div>
            <div class="${ROW_RIGHT}">${ICONS['chevron-right']}</div>
          </button>
        </li>

        <li class="list-row p-0">
          <button type="button" class="list-col-grow flex items-center justify-between w-full py-4 px-4 bg-transparent border-0 font-[inherit] text-base-content cursor-pointer" id="export-data" aria-label="Export data">
            <div class="${ROW_LEFT}">${ICONS.download}<span class="${ROW_LABEL}">Export data</span></div>
            <div class="${ROW_RIGHT}">${ICONS['chevron-right']}</div>
          </button>
        </li>
      </ul>

      <p id="discreet-explainer" class="hidden text-flow-micro text-base-content/60 mt-flow-2">To switch to a discreet home screen icon, remove Moonflow from your home screen and reinstall using the alternate link.</p>
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
  const pinToggle = /** @type {HTMLInputElement} */ (container.querySelector('#toggle-pin'));
  pinToggle.addEventListener('change', () => onTogglePinLock(pinToggle.checked));

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
