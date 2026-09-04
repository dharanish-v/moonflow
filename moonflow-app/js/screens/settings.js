// @ts-check
// screens/settings.js — see "Settings" in moonflow-design-system.md and ADR-011
// (discreet icon is an install-time choice, not a live toggle here).

import { ICONS } from '../icons.js';

/**
 * @param {{pinLockEnabled: boolean, avgCycleLength: number, avgPeriodLength: number}} settings
 */
export function renderSettingsScreen(settings) {
  return `
    <div class="screen">
      <h1 class="screen__title" style="text-align:left; margin-bottom: var(--space-4);">Settings</h1>

      <div class="list-row">
        <div class="list-row__left">${ICONS.lock}<span class="list-row__label">App lock</span></div>
        <button type="button" class="toggle${settings.pinLockEnabled ? ' toggle--on' : ''}" id="toggle-pin" role="switch" aria-checked="${settings.pinLockEnabled}" aria-label="App lock"><span class="toggle__knob"></span></button>
      </div>

      <div class="list-row">
        <div class="list-row__left">${ICONS.bell}<span class="list-row__label">Reminders</span></div>
        <button type="button" class="toggle" id="toggle-reminders" role="switch" aria-checked="false" aria-label="Reminders" disabled title="Coming in V2"><span class="toggle__knob"></span></button>
      </div>

      <div class="list-row">
        <div class="list-row__left">${ICONS.calendar}<span class="list-row__label">Average cycle length</span></div>
        <div class="list-row__right"><span class="list-row__value">${settings.avgCycleLength} days</span>${ICONS['chevron-right']}</div>
      </div>

      <div class="list-row">
        <div class="list-row__left">${ICONS.droplet}<span class="list-row__label">Average period length</span></div>
        <div class="list-row__right"><span class="list-row__value">${settings.avgPeriodLength} days</span>${ICONS['chevron-right']}</div>
      </div>

      <div class="list-row">
        <div class="list-row__left">${ICONS['eye-off']}<span class="list-row__label">Discreet icon</span></div>
        <div class="list-row__right">${ICONS['chevron-right']}</div>
      </div>

      <div class="list-row">
        <div class="list-row__left">${ICONS.download}<span class="list-row__label">Export data</span></div>
        <button type="button" id="export-data" style="background:none;border:none;padding:0;cursor:pointer;">${ICONS['chevron-right']}</button>
      </div>

      <p id="discreet-explainer" style="display:none; font-size: var(--text-micro); color: var(--text-muted); margin-top: var(--space-2);">To switch to a discreet home screen icon, remove Moonflow from your home screen and reinstall using the alternate link.</p>
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
    pinToggle.classList.toggle('toggle--on', nowOn);
    pinToggle.setAttribute('aria-checked', String(nowOn));
    onTogglePinLock(nowOn);
  });

  const explainer = container.querySelector('#discreet-explainer');
  const discreetRow = [...container.querySelectorAll('.list-row')].find(r => r.textContent.includes('Discreet icon'));
  if (discreetRow) discreetRow.addEventListener('click', () => {
    explainer.style.display = explainer.style.display === 'none' ? 'block' : 'none';
  });

  const rows = [...container.querySelectorAll('.list-row')];
  const cycleRow = rows.find(r => r.textContent.includes('Average cycle length'));
  if (cycleRow) cycleRow.addEventListener('click', onEditCycleLength);
  const periodRow = rows.find(r => r.textContent.includes('Average period length'));
  if (periodRow) periodRow.addEventListener('click', onEditPeriodLength);

  container.querySelector('#export-data').addEventListener('click', onExport);
}
