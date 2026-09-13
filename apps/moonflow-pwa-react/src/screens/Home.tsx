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
import { Info, NotebookPen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { PHASE_COLOR_CLASS, PhaseMotif } from '../components/PhaseMotif';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { todayString } from '../lib/cycle-math';
import { computeHomeStatus } from '../lib/home-status';
import { quoteOfTheDay } from '../lib/quotes';
import { useAppState } from '../state/store';

/** How long the just-logged acknowledgment stays up before it self-clears. */
const LOGGED_ACK_DURATION_MS = 2600;

export function HomeScreen() {
  const { entries, settings } = useAppState();
  const navigate = useNavigate();
  const search = useSearch({ from: '/' });

  const status = computeHomeStatus(entries, settings);
  const quote = quoteOfTheDay(status.cyclePhase);

  // Captures the flag at mount, before the effect below clears it from the
  // URL — a fresh save (LogEntry.tsx) that lands back here is the "just
  // used the app's core action" moment; nothing else set this state to true
  // before, so re-renders from other causes (e.g. a settings change) never
  // replay it.
  const [showLoggedAck, setShowLoggedAck] = useState(() => search.justLogged === true);

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
              Logged — your prediction just updated
            </motion.p>
          )}
        </AnimatePresence>

        <PhaseMotif cyclePhase={status.cyclePhase} ring={status.ring} />

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
              <div className="text-3xl font-bold text-foreground">{status.headline}</div>
              <div className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <span>{status.caption}</span>
                {status.isEstimated && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        aria-label="Why is this estimated?"
                        className="inline-flex items-center gap-0.5 underline decoration-dotted underline-offset-2"
                      >
                        estimated
                        <Info className="size-3" aria-hidden="true" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="center" className="w-64 text-xs text-muted-foreground">
                      Based on the date you entered during setup, not real tracking yet — log a couple of real
                      cycles and this sharpens into a confirmed prediction.
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <Button
          onClick={() => navigate({ to: '/log', search: { date: todayString() } })}
          className="h-11 w-full gap-1.5 text-sm"
        >
          <NotebookPen className="size-4" aria-hidden="true" />
          Log
        </Button>

        <p className="mt-5 text-center text-xs text-muted-foreground/80 italic">"{quote}"</p>
      </motion.div>
    </div>
  );
}
