// @ts-check
// screens/log-entry.js — shared between logging "today" and editing/backdating a past
// day (tapped from the calendar). See moonflow-design-system.md "Log entry" and the
// data-safety edge-case rules (upsert by date, never append).

import gsap from 'gsap';
import { ICONS } from '../icons.js';
import { FLOW_OPTIONS, SYMPTOM_OPTIONS, MOOD_OPTIONS } from '../constants.js';
import { shouldDismissSheet, DISMISS_DISTANCE_PX } from '../gestures.js';
import { prefersReducedMotion } from '../motion.js';

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
    <button type="button" class="pill${opt.id === flow ? ' pill--selected' : ''}" data-flow="${opt.id}" aria-pressed="${opt.id === flow}">${opt.label}</button>
  `).join('');

  const symptomChips = SYMPTOM_OPTIONS.map(opt => `
    <button type="button" class="chip${symptoms.includes(opt.id) ? ' chip--selected' : ''}" data-symptom="${opt.id}" aria-pressed="${symptoms.includes(opt.id)}">${opt.label}</button>
  `).join('');

  const moodButtons = MOOD_OPTIONS.map(opt => `
    <button type="button" class="mood-option${opt.id === mood ? ' mood-option--selected' : ''}" data-mood="${opt.id}" aria-label="${opt.id}" aria-pressed="${opt.id === mood}">${ICONS[opt.icon]}</button>
  `).join('');

  return `
    <div class="screen log-sheet">
      <div class="log-sheet__handle" aria-hidden="true"></div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: var(--space-6);">
        <span class="screen__title" style="margin:0;">${formatHeaderDate(date)}</span>
        <button type="button" id="log-close" aria-label="Close" style="background:none;border:none;color:var(--text-inactive);cursor:pointer;width:2.75rem;height:2.75rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${ICONS.x}</button>
      </div>

      <div class="field" id="log-field-flow">
        <span class="field__label">Flow</span>
        <div class="pill-group">${flowPills}</div>
      </div>

      <div class="field" id="log-field-symptom">
        <span class="field__label">Symptoms</span>
        <div class="chip-group">${symptomChips}</div>
      </div>

      <div class="field" id="log-field-mood">
        <span class="field__label">Mood</span>
        <div class="mood-group">${moodButtons}</div>
      </div>

      <div class="field">
        <label class="field__label" for="log-note">Notes</label>
        <textarea id="log-note" class="notes-input" placeholder="Add a note for today...">${note}</textarea>
      </div>

      ${existingEntry ? `<button type="button" id="log-clear" style="background:none;border:none;color:var(--accent-rose);font-size:var(--text-secondary-size);font-family:inherit;cursor:pointer;display:inline-flex;align-items:center;min-height:2.75rem;padding:0;margin-bottom:var(--space-2);">Clear this day's log</button>` : ''}

      <p id="log-save-error" style="display:none;color:var(--accent-rose);font-size:var(--text-secondary-size);margin:0 0 var(--space-3);">Couldn't save — try again</p>
      <button type="button" class="button button--primary" id="log-save">Save</button>
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
        p.classList.toggle('pill--selected', selected);
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
      el.classList.toggle('chip--selected', nowSelected);
      el.setAttribute('aria-pressed', String(nowSelected));
      reportDraft();
    });
  });

  container.querySelectorAll('[data-mood]').forEach(el => {
    el.addEventListener('click', () => {
      mood = el.getAttribute('data-mood');
      container.querySelectorAll('[data-mood]').forEach(m => {
        const selected = m === el;
        m.classList.toggle('mood-option--selected', selected);
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
