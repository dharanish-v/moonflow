// src/screens/Home.tsx — the main hub. Ported from screens/home.js. The
// real 3D moon (Phase 5) is React.lazy-loaded and additive on top of
// StaticMoonFallback — the load-bearing rendering for reduced-motion/no-
// WebGL2 users, and the Suspense fallback while the R3F chunk loads for
// everyone else. Both visuals are decorative (aria-hidden); the sr-only
// label below is the one, render-path-independent accessible description.
import { lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { StaticMoonFallback } from '../components/StaticMoonFallback';
import { DropletIcon, MoodSmileIcon, NotesIcon } from '../components/icons';
import { useRenderMode } from '../hooks/useRenderMode';
import { todayString } from '../lib/cycle-math';
import { computeHomeStatus } from '../lib/home-status';
import { moonPhaseLabel } from '../lib/moon-phase';
import { useAppState } from '../state/store';

const MoonPhase3D = lazy(() => import('../components/MoonPhase3D'));

const QUICK_ACTIONS = [
  { kind: 'flow', label: 'Flow', Icon: DropletIcon, colorClass: 'text-secondary' },
  { kind: 'mood', label: 'Mood', Icon: MoodSmileIcon, colorClass: 'text-primary' },
  { kind: 'symptom', label: 'Symptom', Icon: NotesIcon, colorClass: 'text-accent' },
] as const;

export function HomeScreen() {
  const { entries, settings } = useAppState();
  const navigate = useNavigate();
  const renderMode = useRenderMode();

  const status = computeHomeStatus(entries, settings);
  const dayLabel = status.cycleDay !== null ? `Day ${status.cycleDay}` : moonPhaseLabel(status.moonPhase);

  return (
    <div className="mx-auto box-border flex w-full max-w-[26rem] flex-1 flex-col justify-center px-flow-5 py-flow-6">
      {renderMode === 'canvas3d' ? (
        <Suspense fallback={<StaticMoonFallback phase={status.moonPhase} />}>
          <MoonPhase3D phase={status.moonPhase} />
        </Suspense>
      ) : (
        <StaticMoonFallback phase={status.moonPhase} />
      )}
      <span className="sr-only">{moonPhaseLabel(status.moonPhase)}</span>
      <div className="mt-flow-4 text-center">
        <div className="text-flow-hero font-bold text-foreground">{dayLabel}</div>
        <div className="text-flow-caption text-muted-foreground">
          {status.statusText}
          {status.isEstimated ? ' · estimated' : ''}
        </div>
      </div>
      {/* text-muted-foreground/60 measured 2.86:1 against the background —
          below WCAG AA's 4.5:1 for real text — caught live via a Lighthouse
          pass; full-opacity text-muted-foreground (already proven passing
          elsewhere on this same screen) is still the most subdued text here. */}
      <div className="mt-flow-5 text-center text-flow-nav tracking-[0.05em] text-muted-foreground">பிறை</div>

      <div className="mt-flow-6 flex gap-flow-3">
        {QUICK_ACTIONS.map(({ kind, label, Icon, colorClass }) => (
          <button
            key={kind}
            type="button"
            onClick={() => navigate(`/log?date=${todayString()}&focus=${kind}`)}
            className="flex min-h-11 flex-1 flex-col items-center gap-flow-2 rounded-lg border border-border bg-card py-flow-4"
          >
            <Icon className={`size-[1.125rem] ${colorClass}`} />
            <span className="text-flow-caption font-normal text-foreground/80">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
