// src/components/RemindersSheet.tsx — T67: hand the next predicted periods to
// iOS Calendar as an .ics file, so Calendar does the reminding.
import { useState } from 'react';
import { computeForecast } from '../lib/forecast';
import { buildIcs, upcomingPeriods } from '../lib/ics';
import { shareOrDownload } from '../lib/share-file';
import type { Entry, Settings } from '../lib/types';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from './ui/drawer';
import { Label } from './ui/label';
import { Switch } from './ui/switch';

const COUNT = 6;

export function RemindersSheet({
  open,
  onOpenChange,
  entries,
  settings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: Entry[];
  settings: Settings;
}) {
  const [neutral, setNeutral] = useState(true);
  const forecast = computeForecast(entries, settings);
  const next = forecast.status === 'late' || !forecast.next ? null : forecast.next.date;
  const used = forecast.usedCycleLengths;
  const typical = used.length ? Math.round([...used].sort((a, b) => a - b)[Math.floor(used.length / 2)]!) : settings.avgCycleLength;

  async function add() {
    if (!next) return;
    const ics = buildIcs({ dates: upcomingPeriods(next, typical, COUNT), neutral, now: new Date() });
    const outcome = await shareOrDownload(new File([ics], 'reminders.ics', { type: 'text/calendar' }), 'Reminders');
    if (outcome !== 'cancelled') onOpenChange(false);
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-[26rem] px-4 pb-5">
        <DrawerHeader className="px-0">
          <DrawerTitle>Calendar reminders</DrawerTitle>
          <DrawerDescription>
            Adds your next {COUNT} predicted periods to the Calendar app, each with a reminder at 9am the day before. Calendar
            sends the notifications — nothing is sent anywhere by this app.
          </DrawerDescription>
        </DrawerHeader>
        <div className="mb-3 flex items-center justify-between gap-3">
          <Label htmlFor="ics-neutral" className="text-sm">
            Neutral titles ("Reminder")
          </Label>
          <Switch id="ics-neutral" checked={neutral} onCheckedChange={setNeutral} aria-label="Neutral titles" />
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Calendar events sync to iCloud and can show on your lock screen. Update them any time by adding again — the
          events are replaced, not duplicated. Predictions change as you log, so re-add after a new period.
        </p>
        {!next && (
          <Alert className="mb-3">
            <AlertDescription>There's no upcoming prediction to add right now.</AlertDescription>
          </Alert>
        )}
        <Button disabled={!next} onClick={() => void add()} className="h-11 w-full text-sm">
          Add to Calendar
        </Button>
      </DrawerContent>
    </Drawer>
  );
}
