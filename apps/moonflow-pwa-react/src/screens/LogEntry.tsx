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
} from '../components/ui/alert-dialog';
import { Button } from '../components/ui/button';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerTitle } from '../components/ui/drawer';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { MAX_TAG_LENGTH } from '../lib/import';
import { Textarea } from '../components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group';
import { MOOD_ICONS } from '../components/mood-icons';
import { FLOW_OPTIONS, MOOD_OPTIONS, MUCUS_OPTIONS, PERIOD_FLOW_LEVELS, SYMPTOM_OPTIONS } from '../lib/constants';
import { displayTemperature, parseTemperature } from '../lib/temperature';
import { addDays, todayString } from '../lib/cycle-math';
import { deleteEntryAndClearDraft, saveEntry, saveEntryAndClearDraft } from '../lib/db';
import { offerUndo } from '../lib/undo-signal';
import { useSaveSettings } from '../state/useSaveSettings';
import { formatHeaderDate, resolveInitialDraft } from '../lib/log-entry';
import type { FlowId, LogEntryInput, MoodId, MucusId, SymptomId } from '../lib/types';
import { useDraftAutosave } from '../hooks/useDraftAutosave';
import { useAppDispatch, useAppState } from '../state/hooks';

const ORIGIN_PATH = { home: '/', calendar: '/calendar', insights: '/insights' } as const;

export function LogEntryScreen() {
  const { entries, settings } = useAppState();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const search = useSearch({ from: '/log' });
  const { reportDraft, clearDraft } = useDraftAutosave();
  const saveSettingsPatch = useSaveSettings();

  const date = search.date || todayString();
  const isToday = date === todayString();
  const existingEntry = entries.find((e) => e.date === date) ?? null;
  // Where closing/saving returns to: the screen that opened the sheet. Links
  // without an origin fall back to the old rule (edits → Calendar).
  const returnTo = search.from ? ORIGIN_PATH[search.from] : existingEntry ? '/calendar' : '/';
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const viewportListenerRef = useRef<(() => void) | null>(null);

  const initial = resolveInitialDraft(date, existingEntry, settings.draftEntry);
  // A shortcut link's flow/symptom pre-select on top of whatever is logged.
  const [flow, setFlow] = useState<FlowId | null>(search.flow ?? initial.flow);
  const [symptoms, setSymptoms] = useState<SymptomId[]>(
    search.symptom && !initial.symptoms.includes(search.symptom) ? [...initial.symptoms, search.symptom] : initial.symptoms,
  );
  const [mood, setMood] = useState<MoodId | null>(initial.mood);
  const [note, setNote] = useState(initial.note);
  const [tags, setTags] = useState<string[]>(initial.tags);
  // Fertility-awareness fields (T88) — only shown when the feature is on.
  const unit = settings.temperatureUnit;
  const [tempText, setTempText] = useState(initial.temperature !== null ? displayTemperature(initial.temperature, unit) : '');
  const [tempDisturbed, setTempDisturbed] = useState(initial.tempDisturbed);
  const [mucus, setMucus] = useState<MucusId | null>(initial.mucus ?? null);
  const temperature = tempText.trim() ? parseTemperature(tempText, unit) : null;
  const tempInvalid = tempText.trim() !== '' && temperature === null;
  const [newTag, setNewTag] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  function currentDraft(overrides: Partial<LogEntryInput> = {}): LogEntryInput {
    return { date, flow, symptoms, mood, note, tags, temperature, tempDisturbed, mucus, ...overrides };
  }

  const isDirty =
    flow !== initial.flow ||
    mood !== initial.mood ||
    note !== initial.note ||
    symptoms.length !== initial.symptoms.length ||
    symptoms.some((s) => !initial.symptoms.includes(s)) ||
    temperature !== initial.temperature ||
    tempDisturbed !== initial.tempDisturbed ||
    mucus !== (initial.mucus ?? null) ||
    tags.length !== initial.tags.length ||
    tags.some((t) => !initial.tags.includes(t));

  const trimmedTag = newTag.trim().slice(0, MAX_TAG_LENGTH);
  const canAddTag = trimmedTag.length > 0 && !settings.customTags.some((t) => t.toLowerCase() === trimmedTag.toLowerCase());

  function toggleTag(tag: string) {
    const next = tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
    setTags(next);
    reportDraft(currentDraft({ tags: next }));
  }

  async function addTag() {
    if (!canAddTag) return;
    const tag = trimmedTag;
    setNewTag('');
    await saveSettingsPatch({ customTags: [...settings.customTags, tag] });
    const next = [...tags, tag];
    setTags(next);
    reportDraft(currentDraft({ tags: next }));
  }

  // The sheet mounts already open (it's a route), so Radix's open-autofocus
  // never fires — move focus to its title so screen readers start there.
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const t = setTimeout(() => titleRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(
    () => () => {
      if (viewportListenerRef.current) window.visualViewport?.removeEventListener('resize', viewportListenerRef.current);
    },
    [],
  );

  // One tap during a period: carry yesterday's flow/symptoms/tags forward.
  const yesterdayEntry = entries.find((e) => e.date === addDays(date, -1)) ?? null;
  function copyYesterday() {
    if (!yesterdayEntry) return;
    const next = { flow: yesterdayEntry.flow, symptoms: [...yesterdayEntry.symptoms], tags: [...(yesterdayEntry.tags ?? [])] };
    setFlow(next.flow);
    setSymptoms(next.symptoms);
    setTags(next.tags);
    reportDraft(currentDraft(next));
  }

  function requestClose() {
    if (isDirty) setConfirmDiscard(true);
    else void goBack();
  }

  async function goBack() {
    clearDraft();
    // A failed clear leaves a stale draft for this date — harmless (it
    // pre-fills the form next time), so closing still closes.
    await saveSettingsPatch({ draftEntry: null });
    navigate({ to: returnTo, replace: true });
  }

  async function handleSave() {
    setIsSaving(true);
    setSaveError(false);
    const saved = await saveEntryAndClearDraft({ date, flow, symptoms, mood, note, tags, temperature, tempDisturbed, mucus });
    if (!saved) {
      setIsSaving(false);
      setSaveError(true);
      return;
    }
    clearDraft();
    dispatch({ type: 'UPSERT_ENTRY', entry: saved });
    dispatch({ type: 'PATCH_SETTINGS', patch: { draftEntry: null } });
    // A fresh save (no prior entry for this date) landing back on Home is
    // the "just used the app's core action" moment — flag it so Home can
    // acknowledge the save instead of just silently re-rendering. Editing
    // an existing entry lands on Calendar instead, where this doesn't apply.
    if (returnTo === '/' && !existingEntry) {
      navigate({
        to: '/',
        search: { justLogged: flow && PERIOD_FLOW_LEVELS.includes(flow) ? 'prediction' : 'saved' },
        replace: true,
      });
    } else {
      navigate({ to: returnTo, replace: true });
    }
  }

  async function handleClear() {
    setSaveError(false);
    const ok = await deleteEntryAndClearDraft(date);
    if (!ok) {
      setSaveError(true);
      return;
    }
    clearDraft();
    dispatch({ type: 'REMOVE_ENTRY', date });
    dispatch({ type: 'PATCH_SETTINGS', patch: { draftEntry: null } });
    const removed = existingEntry;
    if (removed) {
      offerUndo({
        message: `Cleared ${formatHeaderDate(date)}`,
        undo: async () => {
          if (await saveEntry(removed)) dispatch({ type: 'UPSERT_ENTRY', entry: { ...removed, updatedAt: Date.now() } });
        },
      });
    }
    navigate({ to: returnTo, replace: true });
  }

  return (
    <Drawer open onOpenChange={(open) => { if (!open) requestClose(); }}>
      <DrawerContent className="mx-auto max-w-[26rem] px-4 pb-5">
        <div className="mb-5 flex items-center justify-between px-0 pt-2">
          <DrawerTitle ref={titleRef} tabIndex={-1} className="text-base font-medium text-foreground outline-none">
            {formatHeaderDate(date)}
          </DrawerTitle>
          <DrawerDescription className="sr-only">Log flow, symptoms, mood, and notes for this day</DrawerDescription>
          <DrawerClose asChild>
            <Button variant="ghost" size="icon-touch" aria-label="Close" className="rounded-full text-muted-foreground">
              <X className="size-5" />
            </Button>
          </DrawerClose>
        </div>

        {yesterdayEntry && !existingEntry && (
          <Button variant="outline" onClick={copyYesterday} className="mb-4 h-11 w-full text-sm">
            Same as yesterday
          </Button>
        )}

        <div className="mb-5">
          <span id="log-flow-label" className="mb-1.5 block text-sm text-muted-foreground">Flow</span>
          <ToggleGroup
            type="single"
            aria-labelledby="log-flow-label"
            value={flow ?? ''}
            onValueChange={(value) => {
              // Tapping the selected option again clears it.
              const id = value ? (value as FlowId) : null;
              setFlow(id);
              reportDraft(currentDraft({ flow: id }));
            }}
            className="w-full flex-wrap gap-1.5"
          >
            {FLOW_OPTIONS.map((opt) => (
              <ToggleGroupItem key={opt.id} value={opt.id} variant="pill" className="min-h-11 min-w-[4.5rem] flex-1 px-2">
                {opt.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="mb-5">
          <span id="log-symptoms-label" className="mb-1.5 block text-sm text-muted-foreground">Symptoms</span>
          <ToggleGroup
            type="multiple"
            role="group"
            aria-labelledby="log-symptoms-label"
            value={symptoms}
            onValueChange={(value) => {
              const next = value as SymptomId[];
              setSymptoms(next);
              reportDraft(currentDraft({ symptoms: next }));
            }}
            className="flex-wrap justify-start gap-1.5"
          >
            {SYMPTOM_OPTIONS.filter((opt) => !opt.perimenopause || settings.perimenopauseMode || symptoms.includes(opt.id)).map((opt) => (
              <ToggleGroupItem key={opt.id} value={opt.id} variant="chip" className="min-h-11 px-3">
                {opt.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="mb-5">
          <span id="log-mood-label" className="mb-1.5 block text-sm text-muted-foreground">Mood</span>
          <ToggleGroup
            type="single"
            aria-labelledby="log-mood-label"
            value={mood ?? ''}
            onValueChange={(value) => {
              const id = value ? (value as MoodId) : null;
              setMood(id);
              reportDraft(currentDraft({ mood: id }));
            }}
            className="w-full justify-between gap-0"
          >
            {MOOD_OPTIONS.map((opt) => {
              const Icon = MOOD_ICONS[opt.id];
              return (
                <ToggleGroupItem key={opt.id} value={opt.id} variant="mood" aria-label={opt.label} className="size-11 p-0">
                  <Icon />
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        </div>

        {settings.fertilityAwareness && (
          <div className="mb-5">
            <Label htmlFor="log-temp" className="mb-1.5 block text-sm text-muted-foreground">
              Temperature (°{unit})
            </Label>
            <div className="flex items-center gap-3">
              <Input
                id="log-temp"
                inputMode="decimal"
                autoComplete="off"
                placeholder={unit === 'F' ? 'e.g. 97.7' : 'e.g. 36.50'}
                value={tempText}
                aria-invalid={tempInvalid || undefined}
                aria-describedby={tempInvalid ? 'log-temp-error' : undefined}
                onChange={(e) => {
                  setTempText(e.target.value);
                  const t = e.target.value.trim() ? parseTemperature(e.target.value, unit) : null;
                  reportDraft(currentDraft({ temperature: t }));
                }}
                className="h-11 w-32"
              />
              <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={tempDisturbed}
                  onChange={(e) => {
                    setTempDisturbed(e.target.checked);
                    reportDraft(currentDraft({ tempDisturbed: e.target.checked }));
                  }}
                  className="size-5 accent-[var(--primary)]"
                />
                Disturbed (ill, bad sleep, alcohol, late)
              </label>
            </div>
            {tempInvalid && (
              <p id="log-temp-error" className="mt-1 text-sm text-destructive">
                That doesn't look like a body temperature in °{unit}.
              </p>
            )}

            <span id="log-mucus-label" className="mt-4 mb-1.5 block text-sm text-muted-foreground">
              Cervical mucus
            </span>
            <ToggleGroup
              type="single"
              aria-labelledby="log-mucus-label"
              value={mucus ?? ''}
              onValueChange={(value) => {
                const id = value ? (value as MucusId) : null;
                setMucus(id);
                reportDraft(currentDraft({ mucus: id }));
              }}
              className="w-full flex-wrap justify-start gap-1.5"
            >
              {MUCUS_OPTIONS.map((opt) => (
                <ToggleGroupItem key={opt.id} value={opt.id} variant="chip" title={opt.hint} className="min-h-11 px-3">
                  {opt.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        )}

        <div className="mb-5">
          <span id="log-tags-label" className="mb-1.5 block text-sm text-muted-foreground">
            Tags
          </span>
          <div role="group" aria-labelledby="log-tags-label" className="mb-2 flex flex-wrap gap-1.5">
            {settings.customTags.map((tag) => (
              <Button
                key={tag}
                type="button"
                variant="outline"
                aria-pressed={tags.includes(tag)}
                onClick={() => toggleTag(tag)}
                className="min-h-11 rounded-lg px-3 text-sm aria-pressed:border-accent/40 aria-pressed:bg-accent/15 aria-pressed:text-accent"
              >
                {tag}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Label htmlFor="log-new-tag" className="sr-only">
              New tag
            </Label>
            <Input
              id="log-new-tag"
              value={newTag}
              maxLength={MAX_TAG_LENGTH}
              placeholder="Add your own — e.g. Pill taken"
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void addTag();
                }
              }}
              className="h-11"
            />
            <Button type="button" variant="outline" disabled={!canAddTag} onClick={() => void addTag()} className="h-11 px-4 text-sm">
              Add tag
            </Button>
          </div>
        </div>

        <div className="mb-5">
          <Label htmlFor="log-note" className="mb-1.5 block text-sm text-muted-foreground">
            Notes
          </Label>
          <Textarea
            id="log-note"
            value={note}
            placeholder={isToday ? 'Add a note for today…' : 'Add a note…'}
            onFocus={(e) => {
              // The index.html <meta interactive-widget> fix covers
              // Chromium; iOS Safari (the platform this is installed as a
              // PWA on) still just overlays the keyboard without shrinking
              // the viewport. A plain scrollIntoView on focus fires before
              // the keyboard has actually opened — visualViewport's own
              // resize event is what fires once it does, which is the
              // moment this textarea might newly be hidden behind it.
              // One listener at a time — refocusing without a keyboard resize
              // (hardware keyboard) used to stack them up.
              const el = e.currentTarget;
              const vv = window.visualViewport;
              if (!vv) return;
              if (viewportListenerRef.current) vv.removeEventListener('resize', viewportListenerRef.current);
              const onResize = () => {
                el.scrollIntoView({ block: 'center', behavior: 'smooth' });
                viewportListenerRef.current = null;
              };
              viewportListenerRef.current = onResize;
              vv.addEventListener('resize', onResize, { once: true });
            }}
            onChange={(e) => {
              setNote(e.target.value);
              reportDraft(currentDraft({ note: e.target.value }));
            }}
            className="min-h-[4.5rem]"
          />
        </div>


        {saveError && (
          <Alert className="mb-2">
            <AlertDescription>Couldn't save — try again</AlertDescription>
          </Alert>
        )}

        <Button disabled={isSaving || tempInvalid} onClick={() => void handleSave()} className="h-11 w-full text-sm">
          {isSaving ? 'Saving…' : 'Save'}
        </Button>

        {/* Destructive, so kept well away from Save — and undoable, so no
            "are you sure?" dialog (design-system.md's "Cleared — Undo"). */}
        {existingEntry && (
          <Button variant="ghost" onClick={() => void handleClear()} className="mt-6 h-11 w-full text-sm text-destructive">
            Clear this day's log
          </Button>
        )}
        <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
              <AlertDialogDescription>What you entered for {formatHeaderDate(date)} hasn't been saved yet.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button
                onClick={() => {
                  setConfirmDiscard(false);
                  void handleSave();
                }}
                className="h-11 w-full text-sm"
              >
                Save changes
              </Button>
              <AlertDialogAction onClick={() => void goBack()}>Discard</AlertDialogAction>
              <AlertDialogCancel>Keep editing</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DrawerContent>
    </Drawer>
  );
}
