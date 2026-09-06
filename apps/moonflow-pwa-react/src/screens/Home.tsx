// src/screens/Home.tsx — the main hub. Ported from screens/home.js. The
// real 3D scene (Phase 5, grown into a full moon+sky per ADR-033) is
// React.lazy-loaded and additive on top of StaticMoonFallback — the load-
// bearing rendering for reduced-motion/no-WebGL2 users, and the Suspense
// fallback while the R3F chunk loads for everyone else. Both visuals are
// decorative (aria-hidden); the sr-only label below is the one, render-
// path-independent accessible description.
import { lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { StaticMoonFallback } from '../components/StaticMoonFallback';
import { Button } from '../components/ui/button';
import { DropletIcon, MoodSmileIcon, NotesIcon } from '../components/icons';
import { useRenderMode } from '../hooks/useRenderMode';
import { todayString } from '../lib/cycle-math';
import { computeHomeStatus } from '../lib/home-status';
import { moonPhaseLabel } from '../lib/moon-phase';
import { useAppState } from '../state/store';

const HomeScene = lazy(() => import('../components/HomeScene'));

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
    <div className="relative mx-auto box-border flex w-full max-w-[26rem] flex-1 flex-col justify-center overflow-hidden px-flow-5 py-flow-6">
      {renderMode === 'canvas3d' ? (
        <Suspense fallback={<StaticMoonFallback phase={status.moonPhase} cyclePhase={status.cyclePhase} />}>
          <HomeScene phase={status.moonPhase} cyclePhase={status.cyclePhase} />
        </Suspense>
      ) : (
        <StaticMoonFallback phase={status.moonPhase} cyclePhase={status.cyclePhase} />
      )}
      {/* Both the 3D scene and its SVG fallback above are absolute inset-0
          -z-10, filling this whole screen as a full-bleed background (not a
          small square anymore — a movie-poster-style hero image, not an
          icon). This scrim sits between them and the real content below —
          same DOM-order/-z-10 trick, painted later so it layers above the
          sky but still behind static content — guaranteeing the status text
          and quick-action buttons stay legible regardless of how bright the
          current cyclePhase's sky mood is. Solid well before 100% (58%, not
          a soft fade to the very bottom): the bold white "Day N" heading
          reads fine over open sky, but text-muted-foreground's status line
          right below it does not (this screen's own WCAG contrast budget is
          already tight — see the note further down) — verified live that a
          gentler fade left it unreadable. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: 'linear-gradient(to bottom, transparent 0%, transparent 34%, var(--bg-screen) 58%, var(--bg-screen) 100%)' }}
      />
      {/* Preserves the moon's old in-flow footprint so the text below keeps
          its original vertical rhythm, now that the moon+sky render as a
          full-bleed background layer instead of a small flow element. */}
      <div aria-hidden="true" className="h-[150px]" />
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
    </div>
  );
}
