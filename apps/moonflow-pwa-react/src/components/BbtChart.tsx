// src/components/BbtChart.tsx — T90. One cycle's basal temperature chart
// (sympto-thermal charting): readings by cycle day, coverline dashed,
// disturbed readings hollow and left out of the line, the temperature shift
// and mucus peak marked, a mucus strip underneath. The same data is offered
// to screen readers as a summary plus a table.
import { useState } from 'react';
import { MUCUS_OPTIONS } from '../lib/constants';
import { derivePeriods, diffDays, parseDate } from '../lib/cycle-math';
import { analyzeCycle } from '../lib/sympto-thermal';
import { displayTemperature, type TemperatureUnit } from '../lib/temperature';
import type { Entry, MucusId } from '../lib/types';
import { Button } from './ui/button';

const W = 320;
const H = 150;
const PAD = { l: 34, r: 8, t: 8, b: 20 };
const MUCUS_RANK: Record<MucusId, number> = { dry: 0, sticky: 1, creamy: 2, watery: 3, eggwhite: 4 };

const fmtDate = (d: string) => parseDate(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export function BbtChart({ entries, unit }: { entries: Entry[]; unit: TemperatureUnit }) {
  const starts = derivePeriods(entries).map((p) => p.start);
  const withTemps = starts.filter((s, i) => entries.some((e) => e.date >= s && (!starts[i + 1] || e.date < starts[i + 1]!) && typeof e.temperature === 'number'));
  const [index, setIndex] = useState<number | null>(null);
  if (withTemps.length === 0) {
    return <p className="text-sm text-muted-foreground">No temperatures logged yet.</p>;
  }
  const i = index ?? withTemps.length - 1;
  const start = withTemps[i]!;
  const nextStart = starts[starts.indexOf(start) + 1] ?? null;
  const days = entries
    .filter((e) => e.date >= start && (!nextStart || e.date < nextStart))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const a = analyzeCycle(entries, start, nextStart);
  const temps = days.filter((d) => typeof d.temperature === 'number');

  const show = (c: number) => Number(displayTemperature(c, unit));
  const values = temps.map((d) => show(d.temperature!)).concat(a.coverline !== null ? [show(a.coverline)] : []);
  const lo = Math.min(...values) - (unit === 'F' ? 0.2 : 0.1);
  const hi = Math.max(...values) + (unit === 'F' ? 0.2 : 0.1);
  const lastDay = Math.max(28, ...days.map((d) => diffDays(start, d.date) + 1));
  const x = (date: string) => PAD.l + ((diffDays(start, date) + 0.5) / lastDay) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const line = temps
    .filter((d) => !d.tempDisturbed)
    .map((d) => `${x(d.date).toFixed(1)},${y(show(d.temperature!)).toFixed(1)}`)
    .join(' ');

  const summary = [
    `Temperature chart, cycle starting ${fmtDate(start)}: ${temps.length} readings`,
    a.coverline !== null ? `coverline ${displayTemperature(a.coverline, unit)} °${unit}` : 'no temperature shift yet',
    a.ovulationConfirmed ? `ovulation confirmed around ${fmtDate(a.ovulationEstimate!)}` : 'ovulation not confirmed yet',
  ].join('; ');

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Button variant="ghost" disabled={i === 0} onClick={() => setIndex(i - 1)} className="h-11 px-2 text-sm" aria-label="Previous cycle">
          ‹
        </Button>
        <span className="text-sm text-muted-foreground">Cycle starting {fmtDate(start)}</span>
        <Button
          variant="ghost"
          disabled={i === withTemps.length - 1}
          onClick={() => setIndex(i + 1)}
          className="h-11 px-2 text-sm"
          aria-label="Next cycle"
        >
          ›
        </Button>
      </div>

      <svg viewBox={`0 0 ${W} ${H + 14}`} className="w-full" role="img" aria-label={summary}>
        {[lo, (lo + hi) / 2, hi].map((v) => (
          <text key={v} x={PAD.l - 4} y={y(v) + 3} textAnchor="end" fontSize="8" className="fill-muted-foreground">
            {v.toFixed(unit === 'F' ? 1 : 2)}
          </text>
        ))}
        {a.coverline !== null && (
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={y(show(a.coverline))}
            y2={y(show(a.coverline))}
            stroke="var(--muted-foreground)"
            strokeDasharray="3 3"
            strokeWidth="1"
          />
        )}
        {a.ovulationEstimate && (
          <line x1={x(a.ovulationEstimate)} x2={x(a.ovulationEstimate)} y1={PAD.t} y2={H - PAD.b} stroke="var(--primary)" strokeWidth="1" strokeOpacity="0.6" />
        )}
        <polyline points={line} fill="none" stroke="var(--foreground)" strokeWidth="1.5" />
        {temps.map((d) => (
          <circle
            key={d.date}
            cx={x(d.date)}
            cy={y(show(d.temperature!))}
            r="2.6"
            fill={d.tempDisturbed ? 'var(--background)' : a.firstHigherDate && d.date >= a.firstHigherDate ? 'var(--primary)' : 'var(--foreground)'}
            stroke="var(--foreground)"
            strokeWidth="1"
          />
        ))}
        {days
          .filter((d) => d.mucus)
          .map((d) => (
            <rect
              key={`m-${d.date}`}
              x={x(d.date) - 3}
              y={H - 2}
              width="6"
              height="10"
              rx="1.5"
              fill="var(--accent)"
              fillOpacity={0.2 + MUCUS_RANK[d.mucus!] * 0.2}
            />
          ))}
      </svg>
      <p className="mt-1 text-xs text-muted-foreground">
        Dashed line: coverline. Gold: readings after the rise; hollow: disturbed. Blue bars: mucus (darker = more fertile).
        {a.ovulationConfirmed
          ? ` Ovulation confirmed around ${fmtDate(a.ovulationEstimate!)}.`
          : ' Ovulation is only confirmed once both the temperature rise and the mucus change are complete.'}
      </p>

      <table className="sr-only" aria-label="Temperature readings">
        <thead>
          <tr>
            <th>Day</th>
            <th>Temperature</th>
            <th>Mucus</th>
          </tr>
        </thead>
        <tbody>
          {days
            .filter((d) => typeof d.temperature === 'number' || d.mucus)
            .map((d) => (
              <tr key={d.date}>
                <td>{fmtDate(d.date)}</td>
                <td>
                  {typeof d.temperature === 'number' ? `${displayTemperature(d.temperature, unit)} °${unit}` : '—'}
                  {d.tempDisturbed ? ' (disturbed)' : ''}
                </td>
                <td>{MUCUS_OPTIONS.find((m) => m.id === d.mucus)?.label ?? '—'}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
