// src/screens/LogEntry.tsx — ported from screens/log-entry.js. Shared
// between logging "today" and editing/backdating a past day. Swipe-to-
// dismiss uses framer-motion's drag gesture (scoped to the handle via
// dragControls, matching the vanilla app's pointer-events-on-handle-only
// scoping) instead of hand-rolled pointer capture — gestures.ts's pure
// shouldDismissSheet() decision is unchanged and still what's unit-tested.
import { motion, useDragControls, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Chip } from '../components/Chip';
import { MoodButton } from '../components/MoodButton';
import { Pill } from '../components/Pill';
import { MOOD_ICONS } from '../components/icons';
import { FLOW_OPTIONS, MOOD_OPTIONS, SYMPTOM_OPTIONS } from '../lib/constants';
import { todayString } from '../lib/cycle-math';
import { deleteEntry, loadAllEntries, saveEntry, setSetting } from '../lib/db';
import { formatHeaderDate, resolveInitialDraft } from '../lib/log-entry';
import { DISMISS_DISTANCE_PX, shouldDismissSheet } from '../lib/gestures';
import type { FlowId, LogEntryInput, MoodId, SymptomId } from '../lib/types';
import { useDraftAutosave } from '../hooks/useDraftAutosave';
import { useAppDispatch, useAppState } from '../state/store';

type FocusSection = 'flow' | 'symptom' | 'mood' | null;

export function LogEntryScreen() {
  const { entries, settings } = useAppState();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const prefersReducedMotion = useReducedMotion();
  const dragControls = useDragControls();
  const { reportDraft, clearDraft } = useDraftAutosave();

  const date = params.get('date') || todayString();
  const focusSection = (params.get('focus') as FocusSection) || null;
  const existingEntry = entries.find((e) => e.date === date) ?? null;

  const initial = resolveInitialDraft(date, existingEntry, settings.draftEntry);
  const [flow, setFlow] = useState<FlowId | null>(initial.flow);
  const [symptoms, setSymptoms] = useState<SymptomId[]>(initial.symptoms);
  const [mood, setMood] = useState<MoodId | null>(initial.mood);
  const [note, setNote] = useState(initial.note);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const hasCrossedDismissThreshold = useRef(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focusSection || !sectionRef.current) return;
    sectionRef.current.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
    const firstControl = sectionRef.current.querySelector<HTMLElement>('button, textarea, input');
    firstControl?.focus();
    // Only ever needs to run once, right after this exact screen mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function currentDraft(overrides: Partial<LogEntryInput> = {}): LogEntryInput {
    return { date, flow, symptoms, mood, note, ...overrides };
  }

  async function goBack() {
    clearDraft();
    await setSetting('draftEntry', null);
    dispatch({ type: 'PATCH_SETTINGS', patch: { draftEntry: null } });
    navigate(existingEntry ? '/calendar' : '/', { replace: true });
  }

  async function handleSave() {
    setIsSaving(true);
    setSaveError(false);
    const ok = await saveEntry({ date, flow, symptoms, mood, note });
    if (ok === false) {
      setIsSaving(false);
      setSaveError(true);
      return;
    }
    clearDraft();
    await setSetting('draftEntry', null);
    const freshEntries = await loadAllEntries();
    dispatch({ type: 'SET_ENTRIES', entries: freshEntries });
    dispatch({ type: 'PATCH_SETTINGS', patch: { draftEntry: null } });
    navigate(existingEntry ? '/calendar' : '/', { replace: true });
  }

  async function handleClear() {
    await deleteEntry(date);
    clearDraft();
    await setSetting('draftEntry', null);
    const freshEntries = await loadAllEntries();
    dispatch({ type: 'SET_ENTRIES', entries: freshEntries });
    dispatch({ type: 'PATCH_SETTINGS', patch: { draftEntry: null } });
    navigate('/calendar', { replace: true });
  }

  return (
    <motion.div
      className="log-sheet mx-auto mt-auto box-border flex w-full max-w-[26rem] flex-col rounded-t-2xl border-[0.5px] border-border bg-card/80 px-flow-5 py-flow-6 backdrop-blur-[18px]"
      drag="y"
      dragControls={dragControls}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 1 }}
      onDrag={(_, info) => {
        const deltaY = info.offset.y;
        if (deltaY <= 0) return;
        const nowCrossed = deltaY > DISMISS_DISTANCE_PX;
        if (nowCrossed && !hasCrossedDismissThreshold.current) navigator.vibrate?.(10);
        hasCrossedDismissThreshold.current = nowCrossed;
      }}
      onDragEnd={(_, info) => {
        hasCrossedDismissThreshold.current = false;
        const deltaY = Math.max(0, info.offset.y);
        const velocity = Math.max(0, info.velocity.y) / 1000; // px/s -> px/ms
        if (shouldDismissSheet({ deltaY, velocity })) void goBack();
      }}
      initial={prefersReducedMotion ? false : { y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      <div
        className="log-sheet__handle mx-auto mb-flow-4 h-1 w-9 touch-none rounded-full bg-border"
        onPointerDown={(e) => dragControls.start(e)}
        aria-hidden="true"
      />

      <div className="mb-flow-6 flex items-center justify-between">
        <span className="text-center text-flow-title font-medium text-foreground">{formatHeaderDate(date)}</span>
        <button
          type="button"
          aria-label="Close"
          onClick={() => void goBack()}
          className="inline-flex size-11 items-center justify-center rounded-full text-muted-foreground/60 hover:text-foreground"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div className="mb-flow-6" id="log-field-flow" ref={focusSection === 'flow' ? sectionRef : undefined}>
        <span className="mb-flow-2 block text-flow-caption text-muted-foreground">Flow</span>
        <div className="flex gap-flow-2">
          {FLOW_OPTIONS.map((opt) => (
            <Pill
              key={opt.id}
              selected={opt.id === flow}
              onClick={() => {
                setFlow(opt.id);
                reportDraft(currentDraft({ flow: opt.id }));
              }}
            >
              {opt.label}
            </Pill>
          ))}
        </div>
      </div>

      <div className="mb-flow-6" id="log-field-symptom" ref={focusSection === 'symptom' ? sectionRef : undefined}>
        <span className="mb-flow-2 block text-flow-caption text-muted-foreground">Symptoms</span>
        <div className="flex flex-wrap gap-flow-2">
          {SYMPTOM_OPTIONS.map((opt) => {
            const selected = symptoms.includes(opt.id);
            return (
              <Chip
                key={opt.id}
                selected={selected}
                onClick={() => {
                  const next = selected ? symptoms.filter((s) => s !== opt.id) : [...symptoms, opt.id];
                  setSymptoms(next);
                  reportDraft(currentDraft({ symptoms: next }));
                }}
              >
                {opt.label}
              </Chip>
            );
          })}
        </div>
      </div>

      <div className="mb-flow-6" id="log-field-mood" ref={focusSection === 'mood' ? sectionRef : undefined}>
        <span className="mb-flow-2 block text-flow-caption text-muted-foreground">Mood</span>
        <div className="flex justify-between">
          {MOOD_OPTIONS.map((opt) => {
            const Icon = MOOD_ICONS[opt.id];
            return (
              <MoodButton
                key={opt.id}
                selected={opt.id === mood}
                aria-label={opt.id}
                onClick={() => {
                  setMood(opt.id);
                  reportDraft(currentDraft({ mood: opt.id }));
                }}
              >
                <Icon />
              </MoodButton>
            );
          })}
        </div>
      </div>

      <div className="mb-flow-6">
        <label htmlFor="log-note" className="mb-flow-2 block text-flow-caption text-muted-foreground">
          Notes
        </label>
        <textarea
          id="log-note"
          value={note}
          placeholder="Add a note for today..."
          onChange={(e) => {
            setNote(e.target.value);
            reportDraft(currentDraft({ note: e.target.value }));
          }}
          className="min-h-[4.5rem] w-full rounded-md border border-border bg-input/30 px-3 py-2 text-flow-caption text-foreground"
        />
      </div>

      {existingEntry && (
        <button
          type="button"
          onClick={() => void handleClear()}
          className="mb-flow-2 min-h-11 px-0 text-left text-flow-caption text-secondary"
        >
          Clear this day's log
        </button>
      )}

      {saveError && <p className="mb-flow-3 text-flow-caption text-secondary">Couldn't save — try again</p>}

      <button
        type="button"
        disabled={isSaving}
        onClick={() => void handleSave()}
        className="min-h-11 w-full rounded-lg bg-primary text-flow-nav font-medium text-primary-foreground disabled:pointer-events-none disabled:opacity-70"
      >
        {isSaving ? 'Saved' : 'Save'}
      </button>
    </motion.div>
  );
}
