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
    <div class="flex-1 flex flex-col w-full max-w-[26rem] mx-auto box-border py-flow-6 px-flow-5 justify-center">
      <div class="screen__icon w-[2.75rem] h-[2.75rem] rounded-full bg-fertile-tint text-accent-gold flex items-center justify-center mx-auto mb-flow-4">${ICONS.lock}</div>
      <h1 class="text-flow-title font-medium text-ink text-center mb-flow-1">${title}</h1>
      <p class="screen__subtitle text-flow-caption text-center mb-flow-6 text-accent-rose${error ? '' : ' invisible'}">${error || ' '}</p>

      <div class="mb-flow-6">
        <label class="block text-flow-caption text-ink-muted mb-flow-2" for="pin-input">${title}</label>
        <input type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off"
          maxlength="${PIN_LENGTH}" id="pin-input" class="w-full box-border min-h-[2.75rem] bg-surface-card border-[0.5px] border-border-muted rounded-flow-pill py-flow-3 px-flow-4 text-ink font-[inherit] [color-scheme:dark] text-center tracking-[0.5em] text-flow-stat">
      </div>

      ${mode !== 'unlock' ? `<button type="button" class="flex items-center justify-center w-full min-h-[2.75rem] box-border py-flow-3 px-flow-5 rounded-flow-card border-0 text-flow-nav font-medium text-center cursor-pointer font-[inherit] transition-transform duration-100 ease-[ease] active:scale-[0.97] bg-transparent text-ink-muted" id="pin-cancel">Cancel</button>` : ''}
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
  // renderPinLockScreen() only omits the `invisible` utility class from the
  // subtitle when an error was actually passed, so checking for that class
  // here is the same signal without threading a new parameter through mount.
  const subtitle = /** @type {HTMLElement} */ (container.querySelector('.screen__subtitle'));
  if (subtitle && !subtitle.classList.contains('invisible') && !prefersReducedMotion()) {
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
