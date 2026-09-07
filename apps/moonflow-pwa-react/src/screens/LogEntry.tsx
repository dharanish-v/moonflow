// src/screens/LogEntry.tsx — ported from screens/log-entry.js. Shared
// between logging "today" and editing/backdating a past day.
//
// The sheet itself is shadcn's Drawer (vaul) — real swipe-to-dismiss,
// backdrop, and focus-trap/dialog semantics built in, replacing the earlier
// hand-rolled Framer Motion drag implementation (which had none of vaul's
// real modal a11y for free). The old gestures.ts (a hand-rolled dismiss-
// distance/velocity threshold) is gone entirely — vaul has its own
// well-tuned dismiss heuristic, so keeping a parallel reimplementation
// around unused was exactly the duplicated-custom-logic this cleanup
// was for.
//
// Flow/Symptoms/Mood are shadcn's ToggleGroup (single/single/single-select,
// Symptoms would be "multiple") with app-specific variants added to
// ui/toggle.tsx (pill/chip/mood) rather than separate bespoke components.
import { useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Alert, AlertDescription } from '../components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/alert-dialog';
import { Button } from '../components/ui/button';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerTitle } from '../components/ui/drawer';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group';
import { MOOD_ICONS } from '../components/icons';
import { FLOW_OPTIONS, MOOD_OPTIONS, SYMPTOM_OPTIONS } from '../lib/constants';
import { todayString } from '../lib/cycle-math';
import { deleteEntry, loadAllEntries, saveEntry, setSetting } from '../lib/db';
import { formatHeaderDate, resolveInitialDraft } from '../lib/log-entry';
import type { FlowId, LogEntryInput, MoodId, SymptomId } from '../lib/types';
import { useDraftAutosave } from '../hooks/useDraftAutosave';
import { useAppDispatch, useAppState } from '../state/store';

export function LogEntryScreen() {
  const { entries, settings } = useAppState();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const search = useSearch({ from: '/log' });
  const prefersReducedMotion = useReducedMotion();
  const { reportDraft, clearDraft } = useDraftAutosave();

  const date = search.date || todayString();
  const focusSection = search.focus ?? null;
  const existingEntry = entries.find((e) => e.date === date) ?? null;

  const initial = resolveInitialDraft(date, existingEntry, settings.draftEntry);
  const [flow, setFlow] = useState<FlowId | null>(initial.flow);
  const [symptoms, setSymptoms] = useState<SymptomId[]>(initial.symptoms);
  const [mood, setMood] = useState<MoodId | null>(initial.mood);
  const [note, setNote] = useState(initial.note);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

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
    navigate({ to: existingEntry ? '/calendar' : '/', replace: true });
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
    navigate({ to: existingEntry ? '/calendar' : '/', replace: true });
  }

  async function handleClear() {
    await deleteEntry(date);
    clearDraft();
    await setSetting('draftEntry', null);
    const freshEntries = await loadAllEntries();
    dispatch({ type: 'SET_ENTRIES', entries: freshEntries });
    dispatch({ type: 'PATCH_SETTINGS', patch: { draftEntry: null } });
    navigate({ to: '/calendar', replace: true });
  }

  return (
    <Drawer open onOpenChange={(open) => { if (!open) void goBack(); }}>
      <DrawerContent className="mx-auto max-w-[26rem] px-flow-5 pb-flow-6">
        <div className="mb-flow-6 flex items-center justify-between px-0 pt-2">
          <DrawerTitle className="text-flow-title font-medium text-foreground">{formatHeaderDate(date)}</DrawerTitle>
          <DrawerDescription className="sr-only">Log flow, symptoms, mood, and notes for this day</DrawerDescription>
          <DrawerClose asChild>
            <Button variant="ghost" size="icon-touch" aria-label="Close" className="rounded-full text-muted-foreground/60">
              <X className="size-5" />
            </Button>
          </DrawerClose>
        </div>

        <div className="mb-flow-6" id="log-field-flow" ref={focusSection === 'flow' ? sectionRef : undefined}>
          <span className="mb-flow-2 block text-flow-caption text-muted-foreground">Flow</span>
          <ToggleGroup
            type="single"
            value={flow ?? ''}
            onValueChange={(value) => {
              if (!value) return;
              const id = value as FlowId;
              setFlow(id);
              reportDraft(currentDraft({ flow: id }));
            }}
            className="w-full gap-flow-2"
          >
            {FLOW_OPTIONS.map((opt) => (
              <ToggleGroupItem key={opt.id} value={opt.id} variant="pill" className="min-h-11 flex-1 px-2">
                {opt.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="mb-flow-6" id="log-field-symptom" ref={focusSection === 'symptom' ? sectionRef : undefined}>
          <span className="mb-flow-2 block text-flow-caption text-muted-foreground">Symptoms</span>
          <ToggleGroup
            type="multiple"
            value={symptoms}
            onValueChange={(value) => {
              const next = value as SymptomId[];
              setSymptoms(next);
              reportDraft(currentDraft({ symptoms: next }));
            }}
            className="flex-wrap justify-start gap-flow-2"
          >
            {SYMPTOM_OPTIONS.map((opt) => (
              <ToggleGroupItem key={opt.id} value={opt.id} variant="chip" className="min-h-11 px-3">
                {opt.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="mb-flow-6" id="log-field-mood" ref={focusSection === 'mood' ? sectionRef : undefined}>
          <span className="mb-flow-2 block text-flow-caption text-muted-foreground">Mood</span>
          <ToggleGroup
            type="single"
            value={mood ?? ''}
            onValueChange={(value) => {
              if (!value) return;
              const id = value as MoodId;
              setMood(id);
              reportDraft(currentDraft({ mood: id }));
            }}
            className="w-full justify-between gap-0"
          >
            {MOOD_OPTIONS.map((opt) => {
              const Icon = MOOD_ICONS[opt.id];
              return (
                <ToggleGroupItem key={opt.id} value={opt.id} variant="mood" aria-label={opt.id} className="size-11 p-0">
                  <Icon />
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        </div>

        <div className="mb-flow-6">
          <Label htmlFor="log-note" className="mb-flow-2 block text-flow-caption text-muted-foreground">
            Notes
          </Label>
          <Textarea
            id="log-note"
            value={note}
            placeholder="Add a note for today..."
            onChange={(e) => {
              setNote(e.target.value);
              reportDraft(currentDraft({ note: e.target.value }));
            }}
            className="min-h-[4.5rem] text-flow-caption"
          />
        </div>

        {existingEntry && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="link"
                className="mb-flow-2 h-11 justify-start px-0 text-flow-caption text-secondary no-underline"
              >
                Clear this day's log
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear this day's log?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes everything logged for {formatHeaderDate(date)} — flow, symptoms, mood, and notes. This
                  can't be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction onClick={() => void handleClear()}>Clear log</AlertDialogAction>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {saveError && (
          <Alert className="mb-flow-3">
            <AlertDescription>Couldn't save — try again</AlertDescription>
          </Alert>
        )}

        <Button disabled={isSaving} onClick={() => void handleSave()} className="h-11 w-full text-flow-nav">
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
      </DrawerContent>
    </Drawer>
  );
}
