// @ts-check
// app.js — entry point. Boot from IndexedDB, then route between screens via
// dynamic import (T13). The tab bar in index.html is real static HTML (ADR-017)
// and is wired here exactly once — it is never re-rendered on navigation.

import { state, setState, subscribe } from './store.js';
import { loadAllEntries, loadAllSettings, saveEntry, deleteEntry, setSetting } from './db.js';
import { hashPin, evaluatePinAttempt } from './pin-auth.js';
import { buildExportPayload, exportFilename } from './export.js';
import { PIN_RELOCK_AFTER_MINUTES } from './constants.js';

const content = document.getElementById('app-content');
const tabBar = document.getElementById('tab-bar');

const SCREENS_WITH_TAB_BAR = new Set(['home', 'calendar', 'insights', 'settings']);

function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// T19 PIN lock — orchestration state for whichever screen the pin-lock module is
// currently rendering. Kept local to app.js (not the shared store) since it is
// pure screen-transient UI state, same spirit as log-entry.js's own local
// flow/symptoms/mood variables (ADR-007).
let pinFlow = { mode: /** @type {'unlock'|'create-1'|'create-2'} */ ('unlock'), firstPinHash: null, error: /** @type {string|null} */ (null), returnScreen: 'home' };

// T20 draft autosave — the latest in-progress log-entry snapshot, reported by
// log-entry.js on every field change, persisted on backgrounding (Page
// Visibility API), not on every keystroke (data-safety edge-case rules).
let latestLogDraft = /** @type {{date: string, flow: string|null, symptoms: string[], mood: string|null, note: string}|null} */ (null);
let hiddenAt = /** @type {number|null} */ (null);

function needsUnlock(settings) {
  return !!(settings.onboardingComplete && settings.pinLockEnabled && settings.pinHash);
}

async function boot() {
  const [entries, settings] = await Promise.all([loadAllEntries(), loadAllSettings()]);
  const locked = needsUnlock(settings);
  if (locked) pinFlow = { mode: 'unlock', firstPinHash: null, error: null, returnScreen: 'home' };
  setState({
    entries,
    settings,
    isOnboarded: settings.onboardingComplete,
    activeScreen: locked ? 'pin-lock' : (settings.onboardingComplete ? 'home' : 'onboarding'),
    calendarMonth: todayString().slice(0, 7)
  });
}

// Page Visibility API drives both T19 (re-lock after being backgrounded past
// the timeout) and T20 (autosave a draft so an iOS-killed tab doesn't lose
// in-progress data) — one listener, since both fire off the same signal.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = Date.now();
    if (state.activeScreen === 'log' && latestLogDraft) {
      setSetting('draftEntry', latestLogDraft);
    }
    return;
  }

  if (hiddenAt !== null && needsUnlock(state.settings) && state.activeScreen !== 'pin-lock') {
    const elapsedMinutes = (Date.now() - hiddenAt) / 60000;
    if (elapsedMinutes >= PIN_RELOCK_AFTER_MINUTES) {
      pinFlow = { mode: 'unlock', firstPinHash: null, error: null, returnScreen: state.activeScreen };
      setState({ activeScreen: 'pin-lock' });
    }
  }
  hiddenAt = null;
});

/** @param {string} pin */
async function handlePinCreated(pin) {
  const hash = await hashPin(pin);
  await setSetting('pinHash', hash);
  await setSetting('pinLockEnabled', true);
  setState({ settings: { ...state.settings, pinHash: hash, pinLockEnabled: true }, activeScreen: pinFlow.returnScreen });
}

/** @param {string} pin */
async function handlePinAttempt(pin) {
  const enteredHash = await hashPin(pin);
  const result = evaluatePinAttempt({
    enteredHash,
    storedHash: state.settings.pinHash,
    failedAttempts: state.settings.pinFailedAttempts || 0,
    lockoutUntil: state.settings.pinLockoutUntil || null,
    now: Date.now()
  });

  if (result.patch) {
    await setSetting('pinFailedAttempts', result.patch.pinFailedAttempts);
    await setSetting('pinLockoutUntil', result.patch.pinLockoutUntil);
  }
  const settings = result.patch ? { ...state.settings, ...result.patch } : state.settings;

  if (result.ok) {
    setState({ settings, activeScreen: pinFlow.returnScreen });
    return;
  }

  pinFlow.error = result.locked ? `Too many attempts — try again in ${result.secondsRemaining}s` : 'Wrong PIN';
  setState({ settings }); // re-render the pin-lock screen with the new error (ADR-007: full re-render on this kind of transition)
}

function updateTabBarVisibilityAndActiveState() {
  if (!tabBar) return;
  tabBar.style.display = SCREENS_WITH_TAB_BAR.has(state.activeScreen) ? 'flex' : 'none';
  tabBar.querySelectorAll('[data-nav]').forEach(btn => {
    const isActive = btn.getAttribute('data-nav') === state.activeScreen;
    btn.classList.toggle('tab-bar__button--active', isActive);
    if (isActive) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });
}

async function exportData() {
  const json = buildExportPayload(state.entries, state.settings, new Date().toISOString());
  const file = new File([json], exportFilename(todayString()), { type: 'application/json' });

  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Moonflow export' });
      return;
    } catch {
      // user cancelled the share sheet, or it failed — fall through to a plain download
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
}

async function render() {
  updateTabBarVisibilityAndActiveState();

  switch (state.activeScreen) {
    case 'onboarding': {
      const { renderOnboardingScreen, mountOnboardingScreen } = await import('./screens/onboarding.js');
      content.innerHTML = renderOnboardingScreen();
      mountOnboardingScreen(content, async (data) => {
        await setSetting('lastPeriodStart', data.lastPeriodStart);
        await setSetting('avgCycleLength', data.avgCycleLength);
        await setSetting('avgPeriodLength', data.avgPeriodLength);
        await setSetting('onboardingComplete', true);
        setState({
          settings: { ...state.settings, ...data, onboardingComplete: true },
          isOnboarded: true,
          activeScreen: 'home'
        });
      });
      break;
    }

    case 'home': {
      const { renderHomeScreen, mountHomeScreen } = await import('./screens/home.js');
      content.innerHTML = renderHomeScreen(state.entries, state.settings);
      mountHomeScreen(content, {
        onQuickAction: () => setState({ activeScreen: 'log', editingDate: todayString() })
      });
      break;
    }

    case 'calendar': {
      const { renderCalendarScreen, mountCalendarScreen } = await import('./screens/calendar.js');
      content.innerHTML = renderCalendarScreen(state.calendarMonth, state.entries, state.settings);
      mountCalendarScreen(content, {
        onSelectDate: (date) => setState({ activeScreen: 'log', editingDate: date }),
        onChangeMonth: (dir) => {
          const [y, m] = state.calendarMonth.split('-').map(Number);
          const next = new Date(y, m - 1 + (dir === 'next' ? 1 : -1), 1);
          setState({ calendarMonth: `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}` });
        }
      });
      break;
    }

    case 'log': {
      const { renderLogEntryScreen, mountLogEntryScreen } = await import('./screens/log-entry.js');
      const date = state.editingDate || todayString();
      const existing = state.entries.find(e => e.date === date) || null;
      const draft = state.settings.draftEntry || null;
      latestLogDraft = null;
      content.innerHTML = renderLogEntryScreen(date, existing, draft);
      mountLogEntryScreen(content, date, {
        onDraftChange: (data) => { latestLogDraft = data; },
        onSave: async (data) => {
          const ok = await saveEntry({ date, ...data });
          if (!ok) return; // db.js already logged the error; a real error toast is a Phase 4/5 refinement
          latestLogDraft = null;
          await setSetting('draftEntry', null);
          const entries = await loadAllEntries();
          setState({ entries, settings: { ...state.settings, draftEntry: null }, activeScreen: existing ? 'calendar' : 'home', editingDate: null });
        },
        onClear: existing
          ? async () => {
              await deleteEntry(date);
              latestLogDraft = null;
              await setSetting('draftEntry', null);
              const entries = await loadAllEntries();
              setState({ entries, settings: { ...state.settings, draftEntry: null }, activeScreen: 'calendar', editingDate: null });
            }
          : undefined,
        onClose: async () => {
          latestLogDraft = null;
          await setSetting('draftEntry', null);
          setState({ settings: { ...state.settings, draftEntry: null }, activeScreen: existing ? 'calendar' : 'home', editingDate: null });
        }
      });
      break;
    }

    case 'insights': {
      const { renderInsightsScreen } = await import('./screens/insights.js');
      content.innerHTML = renderInsightsScreen(state.entries);
      break;
    }

    case 'settings': {
      const { renderSettingsScreen, mountSettingsScreen } = await import('./screens/settings.js');
      content.innerHTML = renderSettingsScreen(state.settings);
      mountSettingsScreen(content, {
        onTogglePinLock: async (enabled) => {
          if (!enabled) {
            await setSetting('pinLockEnabled', false);
            setState({ settings: { ...state.settings, pinLockEnabled: false } });
            return;
          }
          if (state.settings.pinHash) {
            // A PIN was already set before (re-enabling after a prior disable) —
            // no need to make them set a new one.
            await setSetting('pinLockEnabled', true);
            setState({ settings: { ...state.settings, pinLockEnabled: true } });
            return;
          }
          // First time enabling: QA checklist requires entering the PIN twice
          // before it's saved.
          pinFlow = { mode: 'create-1', firstPinHash: null, error: null, returnScreen: 'settings' };
          setState({ activeScreen: 'pin-lock' });
        },
        // Full stepper-editing UI for these two rows is a small follow-up refinement;
        // onboarding already collects both values, so this isn't a blocking gap.
        onEditCycleLength: () => {},
        onEditPeriodLength: () => {},
        onExport: exportData
      });
      break;
    }

    case 'pin-lock': {
      const { renderPinLockScreen, mountPinLockScreen } = await import('./screens/pin-lock.js');
      content.innerHTML = renderPinLockScreen({ mode: pinFlow.mode, error: pinFlow.error });
      mountPinLockScreen(content, {
        onComplete: async (pin) => {
          pinFlow.error = null;
          if (pinFlow.mode === 'unlock') {
            await handlePinAttempt(pin);
          } else if (pinFlow.mode === 'create-1') {
            pinFlow.firstPinHash = await hashPin(pin);
            pinFlow.mode = 'create-2';
            setState({});
          } else { // create-2
            const confirmHash = await hashPin(pin);
            if (confirmHash === pinFlow.firstPinHash) {
              await handlePinCreated(pin);
            } else {
              pinFlow.mode = 'create-1';
              pinFlow.firstPinHash = null;
              pinFlow.error = "PINs didn't match — try again";
              setState({});
            }
          }
        },
        onCancel: pinFlow.mode !== 'unlock' ? () => setState({ activeScreen: pinFlow.returnScreen }) : undefined
      });
      break;
    }
  }
}

// Wire the static tab bar exactly once — it is real HTML in index.html, never
// re-rendered by a screen (ADR-017).
if (tabBar) {
  tabBar.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => setState({ activeScreen: /** @type {string} */ (btn.getAttribute('data-nav')) }));
  });
}

subscribe(render);
boot().then(render);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((err) => {
      console.error('Service worker registration failed:', err);
    });
  });
}
