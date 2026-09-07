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
import { motion } from 'framer-motion';
import { NotebookPen } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { PhaseMotif } from '../components/PhaseMotif';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { todayString } from '../lib/cycle-math';
import { computeHomeStatus } from '../lib/home-status';
import { quoteOfTheDay } from '../lib/quotes';
import { useAppState } from '../state/store';

export function HomeScreen() {
  const { entries, settings } = useAppState();
  const navigate = useNavigate();

  const status = computeHomeStatus(entries, settings);
  const dayLabel = status.cycleDay !== null ? `Day ${status.cycleDay}` : 'Welcome';
  const quote = quoteOfTheDay(status.cyclePhase);

  return (
    <div className="mx-auto box-border flex w-full max-w-[26rem] flex-1 flex-col justify-center px-4 py-5">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
        <PhaseMotif cyclePhase={status.cyclePhase} />

        <Card className="mb-5">
          <CardContent className="flex flex-col items-center py-5 text-center">
            <div className="text-3xl font-bold text-foreground">{dayLabel}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {status.statusText}
              {status.isEstimated ? ' · estimated' : ''}
            </div>
          </CardContent>
        </Card>

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
