// @ts-check
// screens/log-entry.js — shared between logging "today" and editing/backdating a past
// day (tapped from the calendar). See moonflow-design-system.md "Log entry" and the
// data-safety edge-case rules (upsert by date, never append).

import gsap from 'gsap';
import { ICONS } from '../icons.js';
import { FLOW_OPTIONS, SYMPTOM_OPTIONS, MOOD_OPTIONS } from '../constants.js';
import { shouldDismissSheet, DISMISS_DISTANCE_PX } from '../gestures.js';
import { prefersReducedMotion } from '../motion.js';

const PILL_BASE = 'pill flex-1 flex items-center justify-center min-h-[2.75rem] text-center py-flow-2 box-border rounded-flow-pill font-[inherit] text-flow-small cursor-pointer transition-transform duration-100 ease-[ease] active:scale-[0.96]';
/** @param {boolean} selected */
function pillClasses(selected) {
  return selected
    ? `${PILL_BASE} pill--selected border-0 bg-accent-rose text-accent-rose-text font-medium`
    : `${PILL_BASE} border-[0.5px] border-border-muted bg-transparent text-ink-muted font-normal`;
}

const CHIP_BASE = 'chip inline-flex items-center justify-center min-h-[2.75rem] box-border py-flow-2 px-flow-4 rounded-flow-pill font-[inherit] text-flow-small cursor-pointer transition-transform duration-100 ease-[ease] active:scale-[0.96]';
/** @param {boolean} selected */
function chipClasses(selected) {
  return selected
    ? `${CHIP_BASE} chip--selected bg-[rgba(159,184,232,0.18)] border-[0.5px] border-accent-blue text-accent-blue`
    : `${CHIP_BASE} border-[0.5px] border-border-muted bg-transparent text-ink-muted`;
}

const MOOD_BASE = 'mood-option w-[2.75rem] h-[2.75rem] rounded-full flex items-center justify-center cursor-pointer transition-transform duration-100 ease-[ease] active:scale-[0.92]';
/** @param {boolean} selected */
function moodClasses(selected) {
  return selected
    ? `${MOOD_BASE} mood-option--selected bg-fertile-tint border-[1.5px] border-accent-gold text-accent-gold`
    : `${MOOD_BASE} bg-surface-card border-[0.5px] border-border-muted text-ink-inactive`;
}

/**
 * Pure decision for what a log-entry screen should open pre-filled with —
 * see tests/log-entry-draft-tests.html. An in-progress draft for this exact
 * date (T20) takes priority over a previously saved entry, since it represents
 * more recent unsaved edits; a draft for any other date is ignored outright,
 * so a stale draft never leaks into a different day's fresh form.
 * @param {string} date
 * @param {{flow: string|null, symptoms: string[], mood: string|null, note: string}|null} existingEntry
 * @param {{date: string, flow: string|null, symptoms: string[], mood: string|null, note: string}|null} draftEntry
 */
export function resolveInitialDraft(date, existingEntry, draftEntry) {
  const source = (draftEntry && draftEntry.date === date) ? draftEntry : existingEntry;
  return {
    flow: source?.flow ?? null,
    symptoms: source?.symptoms ?? [],
    mood: source?.mood ?? null,
    note: source?.note ?? '',
    fromDraft: source === draftEntry && draftEntry !== null
  };
}

/** @param {string} dateStr "YYYY-MM-DD" */
function formatHeaderDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return isToday ? `Today, ${label}` : label;
}

/**
 * @param {string} date
 * @param {{flow: string|null, symptoms: string[], mood: string|null, note: string}|null} existingEntry
 * @param {{date: string, flow: string|null, symptoms: string[], mood: string|null, note: string}|null} [draftEntry]
 */
export function renderLogEntryScreen(date, existingEntry, draftEntry = null) {
  const { flow, symptoms, mood, note } = resolveInitialDraft(date, existingEntry, draftEntry);

  const flowPills = FLOW_OPTIONS.map(opt => `
    <button type="button" class="${pillClasses(opt.id === flow)}" data-flow="${opt.id}" aria-pressed="${opt.id === flow}">${opt.label}</button>
  `).join('');

  const symptomChips = SYMPTOM_OPTIONS.map(opt => `
    <button type="button" class="${chipClasses(symptoms.includes(opt.id))}" data-symptom="${opt.id}" aria-pressed="${symptoms.includes(opt.id)}">${opt.label}</button>
  `).join('');

  const moodButtons = MOOD_OPTIONS.map(opt => `
    <button type="button" class="${moodClasses(opt.id === mood)}" data-mood="${opt.id}" aria-label="${opt.id}" aria-pressed="${opt.id === mood}">${ICONS[opt.icon]}</button>
  `).join('');

  return `
    <div class="log-sheet flex flex-col w-full max-w-[26rem] mx-auto box-border py-flow-6 px-flow-5 flex-initial bg-glass-fill border-[0.5px] border-glass-border rounded-t-flow-card">
      <div class="log-sheet__handle w-[2.25rem] h-[0.25rem] rounded-[0.125rem] bg-border-muted mx-auto mb-flow-4 [touch-action:none]" aria-hidden="true"></div>
      <div class="flex justify-between items-center mb-flow-6">
        <span class="text-flow-title font-medium text-ink text-center">${formatHeaderDate(date)}</span>
        <button type="button" id="log-close" aria-label="Close" class="bg-transparent border-0 text-ink-inactive cursor-pointer w-[2.75rem] h-[2.75rem] flex items-center justify-center shrink-0">${ICONS.x}</button>
      </div>

      <div class="mb-flow-6" id="log-field-flow">
        <span class="block text-flow-caption text-ink-muted mb-flow-2">Flow</span>
        <div class="flex gap-flow-2">${flowPills}</div>
      </div>

      <div class="mb-flow-6" id="log-field-symptom">
        <span class="block text-flow-caption text-ink-muted mb-flow-2">Symptoms</span>
        <div class="flex flex-wrap gap-flow-2">${symptomChips}</div>
      </div>

      <div class="mb-flow-6" id="log-field-mood">
        <span class="block text-flow-caption text-ink-muted mb-flow-2">Mood</span>
        <div class="flex justify-between">${moodButtons}</div>
      </div>

      <div class="mb-flow-6">
        <label class="block text-flow-caption text-ink-muted mb-flow-2" for="log-note">Notes</label>
        <textarea id="log-note" class="w-full box-border bg-surface-card border-[0.5px] border-border-muted rounded-flow-pill p-flow-3 text-flow-caption text-ink font-[inherit] resize-none min-h-[4.5rem] placeholder:text-ink-inactive" placeholder="Add a note for today...">${note}</textarea>
      </div>

      ${existingEntry ? `<button type="button" id="log-clear" class="bg-transparent border-0 text-accent-rose text-flow-caption font-[inherit] cursor-pointer inline-flex items-center min-h-[2.75rem] p-0 mb-flow-2">Clear this day's log</button>` : ''}

      <p id="log-save-error" class="hidden text-accent-rose text-flow-caption mb-flow-3">Couldn't save — try again</p>
      <button type="button" class="flex items-center justify-center w-full min-h-[2.75rem] box-border py-flow-3 px-flow-5 rounded-flow-card border-0 text-flow-nav font-medium text-center cursor-pointer font-[inherit] transition-transform duration-100 ease-[ease] active:scale-[0.97] bg-accent-gold text-accent-gold-text disabled:opacity-40 disabled:cursor-not-allowed" id="log-save">Save</button>
    </div>
  `;
}

/**
 * @param {HTMLElement} container
 * @param {string} date
 * @param {{
 *   onSave: (data: {flow: string|null, symptoms: string[], mood: string|null, note: string}) => Promise<boolean>|boolean|void,
 *   onClear?: () => void,
 *   onClose: () => void,
 *   onDraftChange?: (draft: {date: string, flow: string|null, symptoms: string[], mood: string|null, note: string}) => void
 * }} handlers
 * @param {'flow'|'symptom'|'mood'|null} [focusSection] Which section to scroll to and
 *   focus on open — the home screen's three quick-action buttons (Flow/Mood/Symptom)
 *   otherwise all land on the exact same screen at the exact same scroll position,
 *   making them functionally identical apart from which icon was tapped.
 */
export function mountLogEntryScreen(container, date, { onSave, onClear, onClose, onDraftChange }, focusSection = null) {
  let flow = null;
  let symptoms = new Set();
  let mood = null;

  // Seed local state from whatever was already rendered as selected, so mount()
  // works correctly whether this is a fresh entry or editing an existing one.
  const selectedPill = container.querySelector('.pill--selected');
  if (selectedPill) flow = selectedPill.getAttribute('data-flow');
  container.querySelectorAll('.chip--selected').forEach(el => symptoms.add(el.getAttribute('data-symptom')));
  const selectedMood = container.querySelector('.mood-option--selected');
  if (selectedMood) mood = selectedMood.getAttribute('data-mood');

  const noteInput = /** @type {HTMLTextAreaElement} */ (container.querySelector('#log-note'));

  // T20: report every field change so app.js can autosave a draft on backgrounding
  // (Page Visibility API) — see the data-safety edge-case rules.
  function reportDraft() {
    if (!onDraftChange) return;
    onDraftChange({ date, flow, symptoms: [...symptoms], mood, note: noteInput.value });
  }

  container.querySelectorAll('[data-flow]').forEach(el => {
    el.addEventListener('click', () => {
      flow = el.getAttribute('data-flow');
      container.querySelectorAll('[data-flow]').forEach(p => {
        const selected = p === el;
        p.className = pillClasses(selected);
        p.setAttribute('aria-pressed', String(selected));
      });
      reportDraft();
    });
  });

  container.querySelectorAll('[data-symptom]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-symptom');
      const nowSelected = !symptoms.has(id);
      if (nowSelected) symptoms.add(id); else symptoms.delete(id);
      el.className = chipClasses(nowSelected);
      el.setAttribute('aria-pressed', String(nowSelected));
      reportDraft();
    });
  });

  container.querySelectorAll('[data-mood]').forEach(el => {
    el.addEventListener('click', () => {
      mood = el.getAttribute('data-mood');
      container.querySelectorAll('[data-mood]').forEach(m => {
        const selected = m === el;
        m.className = moodClasses(selected);
        m.setAttribute('aria-pressed', String(selected));
      });
      reportDraft();
    });
  });

  noteInput.addEventListener('input', reportDraft);

  const closeBtn = container.querySelector('#log-close');
  if (closeBtn) closeBtn.addEventListener('click', onClose);

  // Opening animation — GSAP replaces the old CSS `.log-sheet` keyframe so it
  // shares easing/interruptibility with the drag interaction below (both
  // animate the same element's `y`).
  const sheet = /** @type {HTMLElement} */ (container.querySelector('.log-sheet'));
  if (sheet && !prefersReducedMotion()) {
    gsap.from(sheet, { y: 24, opacity: 0, duration: 0.22, ease: 'power2.out' });
  }

  // T22 swipe-to-dismiss (still native Pointer Events, no gesture library —
  // gestures.js's pure shouldDismissSheet() decision is unchanged; only what
  // plays visually on each outcome is now GSAP instead of a raw style/transition
  // toggle, which previously had zero animation on snap-back at all). Scoped to
  // the drag handle only, so normal taps/typing elsewhere in the sheet are
  // never intercepted.
  const handle = container.querySelector('.log-sheet__handle');
  if (handle && sheet) {
    let dragStartY = /** @type {number|null} */ (null);
    let dragStartTime = 0;
    let hasCrossedDismissThreshold = false;

    handle.addEventListener('pointerdown', (e) => {
      const pe = /** @type {PointerEvent} */ (e);
      // A fresh grab mid-release-tween would otherwise fight GSAP for the
      // same `y` property — kill whatever's still animating first.
      gsap.killTweensOf(sheet);
      dragStartY = pe.clientY;
      dragStartTime = performance.now();
      hasCrossedDismissThreshold = false;
      /** @type {HTMLElement} */ (handle).setPointerCapture(pe.pointerId);
    });

    handle.addEventListener('pointermove', (e) => {
      if (dragStartY === null) return;
      const deltaY = /** @type {PointerEvent} */ (e).clientY - dragStartY;
      if (deltaY <= 0) return;
      gsap.set(sheet, { y: deltaY });

      // Haptic tick right as the drag crosses the distance threshold — felt
      // before the eye confirms it, not after release. Fires once per
      // crossing, resets if the drag retreats back below the threshold
      // (matching the native pull-to-refresh convention this borrows from).
      const nowCrossed = deltaY > DISMISS_DISTANCE_PX;
      if (nowCrossed && !hasCrossedDismissThreshold) navigator.vibrate?.(10);
      hasCrossedDismissThreshold = nowCrossed;
    });

    const endDrag = (/** @type {Event} */ e) => {
      if (dragStartY === null) return;
      const deltaY = Math.max(0, /** @type {PointerEvent} */ (e).clientY - dragStartY);
      const elapsedMs = performance.now() - dragStartTime;
      const velocity = elapsedMs > 0 ? deltaY / elapsedMs : 0;
      dragStartY = null;

      if (shouldDismissSheet({ deltaY, velocity })) {
        gsap.to(sheet, { y: '100%', opacity: 0, duration: 0.2, ease: 'power1.in', onComplete: onClose });
      } else if (prefersReducedMotion()) {
        gsap.set(sheet, { y: 0 });
      } else {
        gsap.to(sheet, { y: 0, duration: 0.5, ease: 'elastic.out(1, 0.6)' });
      }
    };

    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
  }

  const clearBtn = container.querySelector('#log-clear');
  if (clearBtn && onClear) clearBtn.addEventListener('click', onClear);

  const saveBtn = /** @type {HTMLButtonElement} */ (container.querySelector('#log-save'));
  const saveError = container.querySelector('#log-save-error');
  const originalSaveLabel = saveBtn.textContent;

  saveBtn.addEventListener('click', async () => {
    // T24 optimistic Save UI (ADR-018 INP rule): "Saved" renders instantly,
    // before the IndexedDB write resolves underneath — never blocked on it.
    saveBtn.disabled = true; // also prevents a double-tap duplicate save (data-safety rules)
    saveBtn.textContent = 'Saved';
    if (saveError) saveError.style.display = 'none';

    const ok = await onSave({ flow, symptoms: [...symptoms], mood, note: noteInput.value });

    // A falsy result means the write failed — never a silent loss (data-safety
    // rules): restore the button so the user can see something went wrong and retry.
    if (ok === false) {
      saveBtn.disabled = false;
      saveBtn.textContent = originalSaveLabel;
      if (saveError) saveError.style.display = 'block';
    }
  });

  // Land on the section the quick action actually promised, not always the
  // top of the sheet — otherwise Flow/Mood/Symptom are three identical
  // shortcuts to the same screen (see the home-screen quick-action buttons).
  if (focusSection) {
    const sectionEl = container.querySelector(`#log-field-${focusSection}`);
    if (sectionEl) {
      sectionEl.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      const firstControl = /** @type {HTMLElement|null} */ (sectionEl.querySelector('button, textarea, input'));
      firstControl?.focus();
    }
  }
}
