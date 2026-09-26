// src/screens/Report.tsx — T66. A plain, printable summary to show a
// clinician: iOS's print sheet (window.print) also saves it as a PDF. Print
// styles in index.css hide the app chrome; nothing leaves the phone unless
// the user shares the PDF themselves.
import { ChevronLeft, Printer } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '../components/ui/button';
import { parseDate } from '../lib/cycle-math';
import { healthNudges } from '../lib/health-nudges';
import { buildReport } from '../lib/report';
import { useAppState } from '../state/store';

const fmt = (d: string) => parseDate(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export function ReportScreen() {
  const { entries, settings } = useAppState();
  const navigate = useNavigate();
  const r = buildReport(entries);
  const nudges = healthNudges(entries, settings);
  const days = (n: number | null) => (n === null ? '—' : `${n} ${n === 1 ? 'day' : 'days'}`);

  return (
    <div className="report mx-auto box-border flex w-full max-w-[40rem] flex-1 flex-col px-4 py-5">
      <div className="no-print mb-3 flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate({ to: '/insights' })} className="h-11 gap-1 px-2 text-sm">
          <ChevronLeft className="size-4" aria-hidden="true" />
          Insights
        </Button>
        <Button onClick={() => window.print()} className="h-11 gap-1.5 text-sm">
          <Printer className="size-4" aria-hidden="true" />
          Print / Save as PDF
        </Button>
      </div>

      <h1 className="text-xl font-medium text-foreground">Cycle report</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        {fmt(r.from)} – {fmt(r.to)} · self-logged
      </p>

      <dl className="mb-5 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Typical cycle</dt>
          <dd className="font-medium">{days(r.typicalCycle)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Cycle range</dt>
          <dd className="font-medium">
            {r.shortestCycle === null ? '—' : r.shortestCycle === r.longestCycle ? days(r.shortestCycle) : `${r.shortestCycle}–${r.longestCycle} days`}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Typical period</dt>
          <dd className="font-medium">{days(r.typicalPeriod)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Periods logged</dt>
          <dd className="font-medium">{r.periods.length}</dd>
        </div>
      </dl>

      <table aria-label="Periods" className="mb-5 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="py-1.5 font-normal">Started</th>
            <th className="py-1.5 font-normal">Length</th>
            <th className="py-1.5 font-normal">Cycle</th>
          </tr>
        </thead>
        <tbody>
          {r.periods.map((p) => (
            <tr key={p.start} className="border-b border-border/60">
              <td className="py-1.5">{fmt(p.start)}</td>
              <td className="py-1.5">{days(p.days)}</td>
              <td className="py-1.5">{days(p.cycleLength)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {r.symptoms.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-1 text-sm font-medium">Symptoms (days logged)</h2>
          <p className="text-sm text-muted-foreground">{r.symptoms.map((s) => `${s.label} ${s.days}`).join(' · ')}</p>
        </section>
      )}

      {nudges.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-1 text-sm font-medium">Patterns noted</h2>
          <ul className="list-disc pl-5 text-sm text-muted-foreground">
            {nudges.map((n) => (
              <li key={n.id}>{n.title}</li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-muted-foreground">
        Generated from the patient's own logs on their phone. Not a medical record; predictions and patterns are estimates.
      </p>
    </div>
  );
}
