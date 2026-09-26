// src/screens/Home.tsx — the main hub. Ported from screens/home.js.
//
// One "Log" button, not three (Flow/Mood/Symptom) — they used to open the
// exact same LogEntry drawer, just pre-scrolled to a different section via
// a `focus` search param. That wasn't three lightweight shortcuts, it was
// one form with three doors into it: Save never required Flow, and the
// other two sections stayed one swipe away regardless of which button was
// tapped. Three same-weight buttons implied three separate actions that
// didn't actually exist — a real UX debate before this landed, not a
// unilateral call (see the conversation this was decided in).
import { AnimatePresence, motion } from 'framer-motion';
import { Droplet, Info, NotebookPen, ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { PhaseMotif } from '../components/PhaseMotif';
import { PHASE_COLOR_CLASS } from '../lib/phase-colors';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { diffDays, todayString } from '../lib/cycle-math';
import { FLOW_OPTIONS, PERIOD_FLOW_LEVELS, PERIOD_GAP_TOLERANCE_DAYS } from '../lib/constants';
import { deleteEntry, saveEntry } from '../lib/db';
import { describeEntry } from '../lib/entry-summary';
import type { Entry, FlowId } from '../lib/types';
import { Alert, AlertDescription } from '../components/ui/alert';
import { UndoToast } from '../components/UndoToast';
import { computeHomeStatus } from '../lib/home-status';
import { quoteOfTheDay } from '../lib/quotes';
import { backupNudge } from '../lib/backup-nudge';
import { moonPhase } from '../lib/lunar';
import { isDiscreetInstall } from '../lib/install-identity';
import { useAppDispatch, useAppState } from '../state/store';

/** How long the just-logged acknowledgment stays up before it self-clears. */
const LOGGED_ACK_DURATION_MS = 2600;

export function HomeScreen() {
  const { entries, settings } = useAppState();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const search = useSearch({ from: '/' });

  const status = computeHomeStatus(entries, settings);
  const today = todayString();
  const todayEntry = entries.find((e) => e.date === today) ?? null;

  // Still on a period = the latest real period day was within the missed-log
  // tolerance of today; one tap then repeats that day's flow for today.
  const latestPeriodDay = [...entries].reverse().find((e) => e.flow && PERIOD_FLOW_LEVELS.includes(e.flow));
  const stillOnPeriod = !!latestPeriodDay && diffDays(latestPeriodDay.date, today) <= PERIOD_GAP_TOLERANCE_DAYS;
  const quickFlow: FlowId = stillOnPeriod && latestPeriodDay?.flow ? latestPeriodDay.flow : 'medium';
  const [undo, setUndo] = useState<{ message: string; date: string } | null>(null);
  const [quickLogError, setQuickLogError] = useState(false);

  function openSheet() {
    navigate({ to: '/log', search: { date: today, from: 'home' } });
  }

  /** One-tap log, optimistic: the UI updates instantly, the write follows;
   * a failed write rolls the UI back. Undo is offered instead of a confirm. */
  async function quickLog(flow: FlowId) {
    setQuickLogError(false);
    const entry: Entry = { date: today, flow, symptoms: [], mood: null, note: '', updatedAt: Date.now() };
    dispatch({ type: 'UPSERT_ENTRY', entry });
    const ok = await saveEntry(entry);
    if (!ok) {
      dispatch({ type: 'REMOVE_ENTRY', date: today });
      setQuickLogError(true);
      return;
    }
    const label = FLOW_OPTIONS.find((f) => f.id === flow)?.label ?? flow;
    setUndo({ message: `Logged ${label.toLowerCase()} flow for today`, date: today });
  }

  async function handleUndo() {
    if (!undo) return;
    const { date } = undo;
    setUndo(null);
    const ok = await deleteEntry(date);
    if (ok) dispatch({ type: 'REMOVE_ENTRY', date });
    else setQuickLogError(true);
  }

  const dismissUndo = useCallback(() => setUndo(null), []);
  const quote = quoteOfTheDay(status.cyclePhase);
  const PHASE_WORDS = { period: 'on your period', follicular: 'before your fertile window', fertile: 'in your estimated fertile window', luteal: 'after your fertile window', unknown: '' } as const;
  const moonName = moonPhase().name.toLowerCase();
  const ringLabel =
    status.ring && status.cycleDay
      ? `Cycle day ${status.cycleDay} of ${status.ring.totalDays}${PHASE_WORDS[status.cyclePhase] ? `, ${PHASE_WORDS[status.cyclePhase]}` : ''}. Tonight: ${moonName}.`
      : `Tonight: ${moonName}.`;
  const nudge = backupNudge({ lastBackupAt: settings.lastBackupAt, firstEntryDate: entries[0]?.date ?? null, now: Date.now() });

  // Captures the flag at mount, before the effect below clears it from the
  // URL — a fresh save (LogEntry.tsx) that lands back here is the "just
  // used the app's core action" moment; nothing else set this state to true
  // before, so re-renders from other causes (e.g. a settings change) never
  // replay it.
  const [showLoggedAck, setShowLoggedAck] = useState(() => search.justLogged !== undefined);
  const ackText = search.justLogged === 'saved' ? 'Saved' : 'Logged — your prediction just updated';

  useEffect(() => {
    if (search.justLogged) navigate({ to: '/', search: {}, replace: true });
    // Runs once on mount only — clearing the URL's own justLogged flag so a
    // later refresh/revisit never replays the acknowledgment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!showLoggedAck) return;
    const timer = setTimeout(() => setShowLoggedAck(false), LOGGED_ACK_DURATION_MS);
    return () => clearTimeout(timer);
  }, [showLoggedAck]);

  return (
    <div className="mx-auto box-border flex w-full max-w-[26rem] flex-1 flex-col justify-center px-4 py-5">
      {/* Ambient mood wash — the phase color bleeding into the whole screen,
          not just PhaseMotif's own small glow, so the "world reflects your
          cycle" idea reads at screen scale. `fixed` + phone-frame's own
          transform (index.css) anchors this to the frame itself, same
          technique TabBar already relies on — so it covers the full frame
          on desktop's centered device view too, not just this narrow
          content column. Reuses PhaseMotif's exact color-per-phase mapping
          so the two can never drift apart. */}
      <div
        className={`pointer-events-none fixed inset-0 -z-10 opacity-[0.12] ${PHASE_COLOR_CLASS[status.cyclePhase]}`}
        style={{ background: 'radial-gradient(ellipse 70% 55% at 50% 18%, currentColor, transparent 70%)' }}
        aria-hidden="true"
      />

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
        <AnimatePresence>
          {showLoggedAck && (
            <motion.p
              role="status"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="mb-3 text-center text-xs font-medium text-primary"
            >
              {ackText}
            </motion.p>
          )}
        </AnimatePresence>

        <PhaseMotif cyclePhase={status.cyclePhase} ring={status.ring} label={ringLabel} />
        {/* பிறை ("crescent") — a quiet personal signature (design-system.md).
            Never in the discreet install. */}
        {!isDiscreetInstall() && (
          <p lang="ta" aria-hidden="true" className="-mt-3 mb-4 text-center text-xs tracking-widest text-muted-foreground">
            பிறை
          </p>
        )}

        <motion.div
          className="rounded-xl"
          animate={
            showLoggedAck
              ? { boxShadow: ['0 0 0 0px transparent', '0 0 0 3px var(--primary)', '0 0 0 0px transparent'] }
              : undefined
          }
          transition={{ duration: 1.8, ease: 'easeOut' }}
        >
          <Card className="mb-5">
            <CardContent className="flex flex-col items-center py-5 text-center">
              <h1 className="text-3xl font-bold text-foreground">{status.headline}</h1>
              <div className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <span>{status.caption}</span>
                {status.isEstimated && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        aria-label="Why is this estimated?"
                        className="inline-flex min-h-11 items-center gap-0.5 px-1 underline decoration-dotted underline-offset-2"
                      >
                        estimated
                        <Info className="size-3" aria-hidden="true" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="center" className="w-64 text-xs text-muted-foreground">
                      {status.estimateNote}
                    </PopoverContent>
                  </Popover>
                )}
              </div>
              {status.detail && <div className="mt-2 text-xs text-muted-foreground">{status.detail}</div>}
            </CardContent>
          </Card>
        </motion.div>

        {todayEntry ? (
          <>
            <p className="mb-2 text-center text-sm text-foreground">Today: {describeEntry(todayEntry)}</p>
            <Button onClick={openSheet} className="h-11 w-full gap-1.5 text-sm">
              <NotebookPen className="size-4" aria-hidden="true" />
              Edit today
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => void quickLog(quickFlow)} className="h-11 w-full gap-1.5 text-sm">
              <Droplet className="size-4" aria-hidden="true" />
              {stillOnPeriod ? 'Still on my period' : 'Period started today'}
            </Button>
            <Button variant="outline" onClick={openSheet} className="mt-2 h-11 w-full gap-1.5 text-sm">
              <NotebookPen className="size-4" aria-hidden="true" />
              Log symptoms, mood or notes
            </Button>
          </>
        )}
        {quickLogError && (
          <Alert className="mt-2">
            <AlertDescription>Couldn't save — try again</AlertDescription>
          </Alert>
        )}

        <p className="mt-5 text-center text-xs text-muted-foreground italic">"{quote}"</p>

        {nudge && (
          <Link
            to="/settings"
            className="mt-4 flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-border px-3 text-xs text-muted-foreground"
          >
            <ShieldAlert className="size-4 text-primary" aria-hidden="true" />
            <span>
              Back up your data · {nudge}
            </span>
          </Link>
        )}
      </motion.div>
      {undo && <UndoToast message={undo.message} onUndo={() => void handleUndo()} onDismiss={dismissUndo} />}
    </div>
  );
}
