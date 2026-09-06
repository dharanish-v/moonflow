// src/screens/Insights.tsx — ported from screens/insights.js, including its
// "not enough history yet" empty state. The bar-chart/symptom-frequency
// grow-in uses framer-motion's imperative `animate()` against plain DOM refs.
// Symptom-frequency rows are a plain styled div track+fill (role="progressbar"),
// not a native <progress> element — verified live that Chromium's native
// <progress> here ignores accent-color entirely and renders its default
// green, a real cross-browser risk this app's own "every color comes from
// our tokens" rule can't accept.
import { animate, useReducedMotion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { ChartBarIcon } from '../components/icons';
import { computeInsights } from '../lib/insights';
import { useAppState } from '../state/store';

export function InsightsScreen() {
  const { entries } = useAppState();
  const data = computeInsights(entries);
  const prefersReducedMotion = useReducedMotion();
  const barRefs = useRef<Array<HTMLDivElement | null>>([]);
  const fillRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    if (prefersReducedMotion) {
      fillRefs.current.forEach((el, i) => {
        if (el) el.style.width = `${data.topSymptoms[i]?.percent ?? 0}%`;
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
            el.style.width = `${v}%`;
          },
        }),
      );
    });

    return () => controls.forEach((c) => c.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  if (!data.hasEnoughHistory) {
    return (
      <div className="mx-auto box-border flex w-full max-w-[26rem] flex-1 flex-col justify-center px-flow-5 py-flow-6">
        <div className="mx-auto mb-flow-4 flex size-11 items-center justify-center rounded-full bg-primary/15 text-primary">
          <ChartBarIcon className="size-5" />
        </div>
        <h1 className="mb-flow-1 text-center text-flow-title font-medium text-foreground">Insights</h1>
        <p className="text-center text-flow-caption text-muted-foreground">
          Not enough history yet — check back after your next cycle
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto box-border flex w-full max-w-[26rem] flex-1 flex-col px-flow-5 py-flow-6">
      <h1 className="mb-flow-4 text-left text-flow-title font-medium text-foreground">Insights</h1>
      <div className="flex flex-1 flex-col justify-center">
        <div className="mb-flow-3 rounded-lg bg-card px-flow-4 py-flow-4">
          <div className="text-flow-caption text-muted-foreground">Avg cycle</div>
          <div className="mt-flow-1 text-flow-hero font-bold text-primary">{data.avgCycleLength} days</div>
        </div>
        <div className="grid grid-cols-3 gap-flow-3">
          <Stat title="Avg period" value={`${data.avgPeriodLength}d`} />
          <Stat title="Variability" value={`±${data.variability}d`} />
          <Stat title="Logged" value={data.cyclesLogged} />
        </div>

        <div className="mb-flow-3 mt-flow-6 text-flow-caption text-muted-foreground">
          Cycle length, last {data.recentCycleLengths.length} cycles
        </div>
        <div className="flex h-16 items-end gap-flow-3">
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
        <div className="mt-flow-1 flex gap-flow-3">
          {data.recentCycleLengths.map((len, i) => (
            <span key={i} className="flex-1 text-center text-flow-micro text-muted-foreground/60">
              {len}
            </span>
          ))}
        </div>

        {data.topSymptoms.length > 0 && (
          <>
            <div className="mb-flow-3 mt-flow-6 text-flow-caption text-muted-foreground">Most logged symptoms</div>
            {data.topSymptoms.map((s, i) => (
              <div key={s.id} className="mb-flow-3">
                <div className="mb-flow-1 flex justify-between text-flow-caption text-foreground/80">
                  <span>{s.label}</span>
                  <span>{s.percent}%</span>
                </div>
                <div
                  role="progressbar"
                  aria-label={s.label}
                  aria-valuenow={s.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-[0.375rem] w-full overflow-hidden rounded-full bg-border/40"
                >
                  <div
                    ref={(el) => {
                      fillRefs.current[i] = el;
                    }}
                    className="h-full rounded-full bg-accent"
                    style={{ width: prefersReducedMotion ? `${s.percent}%` : '0%' }}
                  />
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-card px-flow-4 py-flow-3">
      <div className="text-flow-micro text-muted-foreground">{title}</div>
      <div className="mt-flow-1 text-flow-stat font-medium text-foreground">{value}</div>
    </div>
  );
}
