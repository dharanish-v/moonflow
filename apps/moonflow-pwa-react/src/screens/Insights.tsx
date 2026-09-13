// src/screens/Insights.tsx — ported from screens/insights.js, including its
// "not enough history yet" empty state. The bar-chart/symptom-frequency
// grow-in uses framer-motion's imperative `animate()` against plain DOM refs.
// Symptom-frequency rows use shadcn's Progress (Radix, a div-based
// aria-valuenow progressbar) — verified live that Chromium's native
// <progress> here ignores accent-color entirely and renders its default
// green, a real cross-browser risk this app's own "every color comes from
// our tokens" rule can't accept.
import { animate, useReducedMotion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { Separator } from '../components/ui/separator';
import { ChartBarIcon, ChevronRightIcon } from '../components/icons';
import { FLOW_OPTIONS } from '../lib/constants';
import { parseDate } from '../lib/cycle-math';
import { computeInsights } from '../lib/insights';
import type { Entry } from '../lib/types';
import { useAppState } from '../state/store';

/** A short "what happened" label for one recent-logs row — flow first (the
 * most meaningful single fact about a day), falling back to a symptom count,
 * then a generic "Logged" for a mood/note-only day. */
function summarizeEntry(entry: Entry): string {
  if (entry.flow && entry.flow !== 'none') {
    return FLOW_OPTIONS.find((f) => f.id === entry.flow)?.label ?? entry.flow;
  }
  if (entry.symptoms.length > 0) {
    return `${entry.symptoms.length} symptom${entry.symptoms.length === 1 ? '' : 's'}`;
  }
  return 'Logged';
}

export function InsightsScreen() {
  const { entries } = useAppState();
  const navigate = useNavigate();
  const data = computeInsights(entries);
  const prefersReducedMotion = useReducedMotion();
  const barRefs = useRef<Array<HTMLDivElement | null>>([]);
  const fillRefs = useRef<Array<HTMLDivElement | null>>([]);
  // Most-recent-first, capped at 10 — the only way to browse your own
  // history today is paging Calendar month-by-month one day at a time.
  const recentEntries = [...entries].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 10);

  useEffect(() => {
    if (prefersReducedMotion) {
      fillRefs.current.forEach((el, i) => {
        const percent = data.topSymptoms[i]?.percent ?? 0;
        if (el) el.style.transform = `translateX(-${100 - percent}%)`;
      });
      return;
    }

    const controls: Array<{ stop: () => void }> = [];
    data.recentCycleLengths.forEach((len, i) => {
      const el = barRefs.current[i];
      if (!el) return;
      const targetHeight = Math.max(8, (len - 20) * 4);
      controls.push(
        animate(0, targetHeight, {
          duration: 0.4,
          ease: 'easeOut',
          delay: i * 0.05,
          onUpdate: (v) => {
            el.style.height = `${v}px`;
          },
        }),
      );
    });

    const barsDuration = data.recentCycleLengths.length * 0.05;
    data.topSymptoms.forEach((s, i) => {
      const el = fillRefs.current[i];
      if (!el) return;
      controls.push(
        animate(0, s.percent, {
          duration: 0.5,
          ease: 'easeOut',
          delay: barsDuration + i * 0.08,
          onUpdate: (v) => {
            el.style.transform = `translateX(-${100 - v}%)`;
          },
        }),
      );
    });

    return () => controls.forEach((c) => c.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  // A real progress signal (0 vs. 1 logged period), not just a flat wait
  // message — data.cyclesLogged is already computed either way, this
  // just surfaces it instead of discarding it.
  const progressText =
    data.cyclesLogged === 0
      ? 'No periods logged yet — log your first one to start building insights.'
      : `${data.cyclesLogged} period logged — one more and you'll see your cycle-length trend.`;

  return (
    <div className="mx-auto box-border flex w-full max-w-[26rem] flex-1 flex-col px-4 py-5">
      <h1 className="mb-3.5 text-left text-base font-medium text-foreground">Insights</h1>

      {!data.hasEnoughHistory ? (
        <div className="mb-5">
          <div className="mx-auto mb-3.5 flex size-11 items-center justify-center rounded-full bg-primary/15 text-primary">
            <ChartBarIcon className="size-5" />
          </div>
          <p className="text-center text-xs text-muted-foreground">{progressText}</p>
        </div>
      ) : (
        <div className="mb-5">
          <Card className="mb-2">
            <CardContent>
              <div className="text-xs text-muted-foreground">Avg cycle</div>
              <div className="mt-1 text-3xl font-bold text-primary">{data.avgCycleLength} days</div>
            </CardContent>
          </Card>
          <div className="grid grid-cols-3 gap-2">
            <Stat title="Avg period" value={`${data.avgPeriodLength}d`} />
            <Stat title="Variability" value={`±${data.variability}d`} />
            <Stat title="Logged" value={data.cyclesLogged} />
          </div>

          <div className="mb-2 mt-5 text-xs text-muted-foreground">
            Cycle length, last {data.recentCycleLengths.length} cycles
          </div>
          <div className="flex h-16 items-end gap-2">
            {data.recentCycleLengths.map((len, i) => (
              <div
                key={i}
                ref={(el) => {
                  barRefs.current[i] = el;
                }}
                className="flex-1 rounded-t-[0.25rem] bg-primary"
                style={{ height: prefersReducedMotion ? Math.max(8, (len - 20) * 4) : 0 }}
              />
            ))}
          </div>
          <div className="mt-1 flex gap-2">
            {data.recentCycleLengths.map((len, i) => (
              <span key={i} className="flex-1 text-center text-xs text-muted-foreground/60">
                {len}
              </span>
            ))}
          </div>

          {data.topSymptoms.length > 0 && (
            <>
              <div className="mb-2 mt-5 text-xs text-muted-foreground">Most logged symptoms</div>
              {data.topSymptoms.map((s, i) => (
                <div key={s.id} className="mb-2">
                  <div className="mb-1 flex justify-between text-xs text-foreground/80">
                    <span>{s.label}</span>
                    <span>{s.percent}%</span>
                  </div>
                  <Progress
                    value={s.percent}
                    animated={!prefersReducedMotion}
                    aria-label={s.label}
                    indicatorRef={(el) => {
                      fillRefs.current[i] = el;
                    }}
                  />
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {recentEntries.length > 0 && (
        <div>
          <div className="mb-2 text-xs text-muted-foreground">Recent logs</div>
          <Card className="gap-0 p-0 ring-border/60">
            {recentEntries.map((entry, i) => (
              <div key={entry.date}>
                <Button
                  variant="ghost"
                  onClick={() => navigate({ to: '/log', search: { date: entry.date } })}
                  className="h-11 w-full justify-between rounded-none px-3.5 text-left"
                >
                  <span className="text-xs text-foreground">
                    {parseDate(entry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <span className="text-xs">{summarizeEntry(entry)}</span>
                    <ChevronRightIcon className="size-4" />
                  </span>
                </Button>
                {i < recentEntries.length - 1 && <Separator />}
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}

function Stat({ title, value }: { title: string; value: string | number }) {
  return (
    <Card size="sm">
      <CardContent>
        <div className="text-xs text-muted-foreground">{title}</div>
        <div className="mt-1 text-xl font-medium text-foreground">{value}</div>
      </CardContent>
    </Card>
  );
}
