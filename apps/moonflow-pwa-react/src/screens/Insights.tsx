// src/screens/Insights.tsx — ported from screens/insights.js, including its
// "not enough history yet" empty state. The bar-chart/symptom-frequency
// grow-in is CSS (mf-grow-y / mf-fill in index.css), off under Reduce Motion.
// Symptom-frequency rows use shadcn's Progress (Radix, a div-based
// aria-valuenow progressbar) — verified live that Chromium's native
// <progress> here ignores accent-color entirely and renders its default
// green, a real cross-browser risk this app's own "every color comes from
// our tokens" rule can't accept.
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { Separator } from '../components/ui/separator';
import { ChartBarIcon, ChevronRightIcon } from '../components/icons';
import { computeInsights, cycleBarHeight } from '../lib/insights';
import { describeEntry } from '../lib/entry-summary';
import { HEAVY_BLEEDING_ADVICE, healthNudges } from '../lib/health-nudges';
import { symptomTiming } from '../lib/symptom-timing';
import { searchEntries } from '../lib/search';
import { BbtChart } from '../components/BbtChart';
import { STAGE_TEXT, perimenopauseStage, suggestPerimenopauseMode } from '../lib/perimenopause';
import { useSaveSettings } from '../state/useSaveSettings';
import { formatHeaderDate } from '../lib/log-entry';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAppState } from '../state/hooks';

/** Matches the chart container's h-16. */
const CHART_HEIGHT_PX = 64;

export function InsightsScreen() {
  const { entries, settings } = useAppState();
  const navigate = useNavigate();
  const data = computeInsights(entries);
  const nudges = healthNudges(entries, settings);
  const timing = symptomTiming(entries);
  const stage = perimenopauseStage(entries);
  const suggestMode = suggestPerimenopauseMode(entries, settings);
  const saveSettingsPatch = useSaveSettings();
  const [query, setQuery] = useState('');
  // Most-recent-first, capped at 10 — the only way to browse your own
  // history today is paging Calendar month-by-month one day at a time.
  const recentEntries = [...entries].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 10);
  const shownEntries = query.trim() ? searchEntries(entries, query) : recentEntries;


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
            <Stat title="Avg period" value={`${data.avgPeriodLength} ${data.avgPeriodLength === 1 ? 'day' : 'days'}`} />
            <Stat title="Varies by" value={`${data.variability} ${data.variability === 1 ? 'day' : 'days'}`} />
            <Stat title="Periods logged" value={data.cyclesLogged} />
          </div>

          <div className="mb-2 mt-5 text-xs text-muted-foreground">
            Cycle length, last {data.recentCycleLengths.length} cycles
          </div>
          <div className="flex h-16 items-end gap-2">
            {data.recentCycleLengths.map((len, i) => (
              <div
                key={i}
                className="mf-grow-y flex-1 rounded-t-[0.25rem] bg-primary"
                style={{ height: cycleBarHeight(len, data.recentCycleLengths, CHART_HEIGHT_PX), animationDelay: `${i * 50}ms` }}
              />
            ))}
          </div>
          <div className="mt-1 flex gap-2">
            {data.recentCycleLengths.map((len, i) => (
              <span key={i} className="flex-1 text-center text-xs text-muted-foreground">
                {len}
              </span>
            ))}
          </div>

          {data.topSymptoms.length > 0 && (
            <>
              <div className="mb-2 mt-5 text-xs text-muted-foreground">Most logged symptoms</div>
              {data.topSymptoms.map((s, i) => (
                <div key={s.id} className="mb-2">
                  <div className="mb-1 flex justify-between text-sm text-foreground">
                    <span>{s.label}</span>
                    <span>{s.percent}%</span>
                  </div>
                  <Progress
                    value={s.percent}
                    aria-label={s.label}
                    indicatorClassName="mf-fill"
                    indicatorStyle={{ animationDelay: `${data.recentCycleLengths.length * 50 + i * 80}ms` }}
                  />
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {suggestMode && (
        <Card className="mb-5 gap-2 px-4 py-3">
          <p className="text-sm text-foreground">
            Your cycles show changes that are common around perimenopause. Perimenopause mode adds related symptoms and stops
            flagging irregular cycles as unusual.
          </p>
          <Button variant="outline" onClick={() => void saveSettingsPatch({ perimenopauseMode: true })} className="h-11 text-sm">
            Turn on perimenopause mode
          </Button>
        </Card>
      )}

      {settings.perimenopauseMode && (
        <section aria-labelledby="meno-heading" className="mb-5">
          <h2 id="meno-heading" className="mb-2 text-sm font-medium text-foreground">
            Perimenopause
          </h2>
          <Card className="gap-1 px-4 py-3">
            {stage ? (
              <>
                <p className="text-sm font-medium text-foreground">{STAGE_TEXT[stage].title}</p>
                <p className="text-sm text-muted-foreground">{STAGE_TEXT[stage].body}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No transition pattern in your recent cycles yet.</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Based on the STRAW+10 staging criteria, from your own logs. Not a diagnosis — a clinician can confirm where you
              are and talk through options for symptoms.
            </p>
          </Card>
        </section>
      )}

      {settings.fertilityAwareness && (
        <section aria-labelledby="bbt-heading" className="mb-5">
          <h2 id="bbt-heading" className="mb-2 text-sm font-medium text-foreground">
            Temperature
          </h2>
          <Card className="px-3 py-3">
            <BbtChart entries={entries} unit={settings.temperatureUnit} />
          </Card>
        </section>
      )}

      {timing.length > 0 && (
        <section aria-labelledby="timing-heading" className="mb-5">
          <h2 id="timing-heading" className="mb-2 text-sm font-medium text-foreground">
            When symptoms show up
          </h2>
          <Card className="gap-0 px-4 py-2">
            <ul className="flex flex-col divide-y divide-border">
              {timing.map((t) => (
                <li key={t.id} className="py-2 text-sm">
                  <span className="font-medium text-foreground">{t.label}</span>{' '}
                  <span className="text-muted-foreground">{t.text}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {nudges.length > 0 && (
        <section aria-labelledby="nudges-heading" className="mb-5">
          <h2 id="nudges-heading" className="mb-2 text-sm font-medium text-foreground">
            Worth knowing
          </h2>
          <div className="flex flex-col gap-2">
            {nudges.map((n) => (
              <Card key={n.id} className="gap-1 px-4 py-3">
                <p className="text-sm font-medium text-foreground">{n.title}</p>
                <p className="text-sm text-muted-foreground">{n.body}</p>
              </Card>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{HEAVY_BLEEDING_ADVICE}</p>
        </section>
      )}

      <Button variant="outline" onClick={() => navigate({ to: '/insights/report' })} className="mb-5 h-11 w-full text-sm">
        Report for your doctor
      </Button>

      {entries.length > 0 && (
        <div>
          <Label htmlFor="log-search" className="sr-only">
            Search your logs
          </Label>
          <Input
            id="log-search"
            type="search"
            value={query}
            placeholder="Search notes, tags, symptoms…"
            onChange={(e) => setQuery(e.target.value)}
            className="mb-2 h-11"
          />
          <div className="mb-2 text-xs text-muted-foreground" aria-live="polite">
            {query.trim() ? `${shownEntries.length} ${shownEntries.length === 1 ? 'day' : 'days'} found` : 'Recent logs'}
          </div>
          <Card className="gap-0 p-0 ring-border/60">
            {shownEntries.map((entry, i) => (
              <div key={entry.date}>
                <Button
                  variant="ghost"
                  onClick={() => navigate({ to: '/log', search: { date: entry.date, from: 'insights' } })}
                  className="h-11 w-full justify-between rounded-none px-3.5 text-left"
                >
                  <span className="text-sm text-foreground">
                    {formatHeaderDate(entry.date)}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <span className="text-xs">{describeEntry(entry)}</span>
                    <ChevronRightIcon className="size-4" />
                  </span>
                </Button>
                {i < shownEntries.length - 1 && <Separator />}
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
