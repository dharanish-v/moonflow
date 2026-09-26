// src/components/YearView.tsx — T92. "Your year": the last 12 months at a
// glance (one row of day squares per month, periods in rose), and every
// cycle's length over time against the typical 24–38 day range (FIGO).
import { derivePeriods, diffDays, formatDate } from '../lib/cycle-math';
import type { Entry } from '../lib/types';

const monthLabel = (d: Date) => d.toLocaleDateString(undefined, { month: 'short' });

export function YearView({ entries, today = new Date() }: { entries: Array<Pick<Entry, 'date' | 'flow'>>; today?: Date }) {
  const periods = derivePeriods(entries);
  const periodDays = new Set<string>();
  for (const p of periods) {
    for (let i = 0; i <= diffDays(p.start, p.end); i++) {
      const [y, m, d] = p.start.split('-').map(Number) as [number, number, number];
      periodDays.add(formatDate(new Date(y, m - 1, d + i)));
    }
  }
  const months = Array.from({ length: 12 }, (_, i) => new Date(today.getFullYear(), today.getMonth() - 11 + i, 1));
  const first = formatDate(months[0]!);
  const count = periods.filter((p) => p.start >= first && p.start <= formatDate(today)).length;

  return (
    <div role="img" aria-label={`${count} period${count === 1 ? '' : 's'} in the last 12 months`}>
      {months.map((m) => {
        const days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
        return (
          <div key={m.toISOString()} data-testid="year-row" className="mb-0.5 flex items-center gap-1.5" aria-hidden="true">
            <span className="w-8 shrink-0 text-xs text-muted-foreground">{monthLabel(m)}</span>
            <span className="grid flex-1 grid-cols-31 gap-px">
              {Array.from({ length: 31 }, (_, d) => {
                const date = formatDate(new Date(m.getFullYear(), m.getMonth(), d + 1));
                return (
                  <span
                    key={d}
                    className={`aspect-square rounded-[1px] ${d >= days ? 'invisible' : periodDays.has(date) ? 'bg-secondary' : 'bg-muted'}`}
                  />
                );
              })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const W = 300;
const H = 90;
const LO = 15;
const HI = 60;

export function CycleTrend({ entries }: { entries: Array<Pick<Entry, 'date' | 'flow'>> }) {
  const starts = derivePeriods(entries).map((p) => p.start);
  const lengths = starts.slice(1).map((s, i) => diffDays(starts[i]!, s));
  if (lengths.length < 2) return null;
  const x = (i: number) => 6 + (i / (lengths.length - 1)) * (W - 12);
  const y = (v: number) => H - 6 - ((Math.min(HI, Math.max(LO, v)) - LO) / (HI - LO)) * (H - 12);
  const summary = `Cycle length over time: ${lengths.length} cycles, from ${Math.min(...lengths)} to ${Math.max(...lengths)} days; typical range 24–38 days`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={summary}>
      <rect x="0" y={y(38)} width={W} height={y(24) - y(38)} fill="var(--accent)" fillOpacity="0.12" />
      <polyline points={lengths.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')} fill="none" stroke="var(--primary)" strokeWidth="1.5" />
      {lengths.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="2.5" fill={v < 24 || v > 38 ? 'var(--secondary)' : 'var(--primary)'} />
      ))}
    </svg>
  );
}
