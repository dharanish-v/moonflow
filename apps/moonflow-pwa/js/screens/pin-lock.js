// @ts-check
// screens/pin-lock.js — T19 PIN lock. Handles both flows with one screen:
// 'unlock' (re-entering an existing PIN, at boot or after a re-lock timeout)
// and 'create-1'/'create-2' (setting a new PIN from Settings, entered twice —
// see the "Setting a PIN requires entering it twice" QA checklist item).
//
// A native numeric input, not a bespoke keypad grid — this project favors the
// smallest working piece throughout (see the ADR log), and inputmode="numeric"
// already gets the correct iOS keyboard for free (edge-case rules).

import gsap from 'gsap';
import { ICONS } from '../icons.js';
import { prefersReducedMotion } from '../motion.js';

const PIN_LENGTH = 4;

/**
 * @param {{mode: 'unlock'|'create-1'|'create-2', error?: string|null}} args
 */
export function renderPinLockScreen({ mode, error }) {
  const title = mode === 'unlock' ? 'Enter your PIN'
    : mode === 'create-2' ? 'Confirm your PIN'
    : 'Set a PIN';

  return `
    <div class="screen screen--centered">
      <div class="screen__icon">${ICONS.lock}</div>
      <h1 class="screen__title">${title}</h1>
      <p class="screen__subtitle" style="color:var(--accent-rose); ${error ? '' : 'visibility:hidden;'}">${error || ' '}</p>

      <div class="field">
        <label class="field__label" for="pin-input">${title}</label>
        <input type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off"
          maxlength="${PIN_LENGTH}" id="pin-input" class="field__date-input"
          style="text-align:center; letter-spacing:0.5em; font-size:var(--text-stat);">
      </div>

      ${mode !== 'unlock' ? `<button type="button" class="button" id="pin-cancel" style="background:none;color:var(--text-muted);">Cancel</button>` : ''}
    </div>
  `;
}

/**
 * @param {HTMLElement} container
 * @param {{
 *   onComplete: (pin: string) => void,
 *   onCancel?: () => void
 * }} handlers
 */
export function mountPinLockScreen(container, { onComplete, onCancel }) {
  const input = /** @type {HTMLInputElement} */ (container.querySelector('#pin-input'));
  input.focus();

  // Wrong-PIN shake — near-universal lock-screen feedback (iOS, Android,
  // banking apps) that was entirely missing before; the error text alone is
  // easy to miss on a screen someone's glancing at, not reading closely.
  // renderPinLockScreen() only omits `visibility:hidden` from the subtitle
  // when an error was actually passed, so checking that inline style here
  // is the same signal without threading a new parameter through mount.
  const subtitle = /** @type {HTMLElement} */ (container.querySelector('.screen__subtitle'));
  if (subtitle && subtitle.style.visibility !== 'hidden' && !prefersReducedMotion()) {
    gsap.fromTo(input, { x: 0 }, { x: 8, duration: 0.06, repeat: 5, yoyo: true, ease: 'power1.inOut', clearProps: 'x' });
  }

  input.addEventListener('input', () => {
    input.value = input.value.replace(/\D/g, '').slice(0, PIN_LENGTH);
    if (input.value.length === PIN_LENGTH) {
      const pin = input.value;
      input.value = '';
      onComplete(pin);
    }
  });

  const cancelBtn = container.querySelector('#pin-cancel');
  if (cancelBtn && onCancel) cancelBtn.addEventListener('click', onCancel);
}
