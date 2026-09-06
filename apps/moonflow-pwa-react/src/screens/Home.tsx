// src/screens/Home.tsx — the main hub. Ported from screens/home.js.
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { DropletIcon, MoodSmileIcon, NotesIcon } from '../components/icons';
import { todayString } from '../lib/cycle-math';
import { computeHomeStatus } from '../lib/home-status';
import { useAppState } from '../state/store';

const QUICK_ACTIONS = [
  { kind: 'flow', label: 'Flow', Icon: DropletIcon, colorClass: 'text-secondary' },
  { kind: 'mood', label: 'Mood', Icon: MoodSmileIcon, colorClass: 'text-primary' },
  { kind: 'symptom', label: 'Symptom', Icon: NotesIcon, colorClass: 'text-accent' },
] as const;

export function HomeScreen() {
  const { entries, settings } = useAppState();
  const navigate = useNavigate();

  const status = computeHomeStatus(entries, settings);
  const dayLabel = status.cycleDay !== null ? `Day ${status.cycleDay}` : 'Welcome';

  return (
    <div className="mx-auto box-border flex w-full max-w-[26rem] flex-1 flex-col justify-center px-flow-5 py-flow-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
        <Card className="mb-flow-6">
          <CardContent className="flex flex-col items-center py-flow-6 text-center">
            <div className="text-flow-hero font-bold text-foreground">{dayLabel}</div>
            <div className="mt-flow-1 text-flow-caption text-muted-foreground">
              {status.statusText}
              {status.isEstimated ? ' · estimated' : ''}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-flow-3">
          {QUICK_ACTIONS.map(({ kind, label, Icon, colorClass }) => (
            <Button
              key={kind}
              variant="outline"
              onClick={() => navigate(`/log?date=${todayString()}&focus=${kind}`)}
              className="h-auto flex-1 flex-col gap-flow-2 bg-card py-flow-4"
            >
              <Icon className={`size-[1.125rem] ${colorClass}`} />
              <span className="text-flow-caption font-normal text-foreground/80">{label}</span>
            </Button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
