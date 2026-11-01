// src/components/RemindersSheet.tsx — T67: hand the next predicted periods to
// iOS Calendar as an .ics file, so Calendar does the reminding.
import { useState } from 'react';
import { getSetting } from '../lib/db';
import { accountsEnabled } from '../lib/features';
import { buildIcs } from '../lib/ics';
import { disablePush, enablePush, pushSupported } from '../lib/push';
import { REMINDER_COUNT, predictedStarts, reminderTimes } from '../lib/reminder-dates';
import { useAppDispatch } from '../state/hooks';
import { useSaveSettings } from '../state/useSaveSettings';
import { shareOrDownload } from '../lib/share-file';
import type { Entry, Settings } from '../lib/types';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from './ui/drawer';
import { Label } from './ui/label';
import { Switch } from './ui/switch';

const COUNT = REMINDER_COUNT;

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
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const dispatch = useAppDispatch();
  const saveSettings = useSaveSettings();
  const starts = predictedStarts(entries, settings, COUNT);
  const next = starts[0] ?? null;

  async function togglePush(on: boolean) {
    if (!settings.account) return;
    setPushBusy(true);
    setPushError(null);
    if (on) {
      const result = await enablePush(settings.account, reminderTimes(starts, Date.now()));
      if (!result.ok) setPushError(result.error);
    } else {
      await disablePush(settings.account);
    }
    dispatch({ type: 'PATCH_SETTINGS', patch: { pushReminders: await getSetting('pushReminders') } });
    setPushBusy(false);
  }

  async function add() {
    if (!next) return;
    const ics = buildIcs({ dates: starts, neutral, now: new Date() });
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
        {accountsEnabled() && (
          <div className="mb-4 rounded-md bg-muted/50 p-3">
            <p className="mb-1.5 text-sm font-medium text-foreground">Notifications</p>
            {!settings.account ? (
              <p className="text-xs text-muted-foreground">
                Sign in (Settings → Account) to get a notification the day before.
              </p>
            ) : !pushSupported() ? (
              <p className="text-xs text-muted-foreground">Add Moonflow to your Home Screen to get notifications.</p>
            ) : (
              <>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <Label htmlFor="push-reminders" className="text-sm">
                    Notify me the day before, at 9am
                  </Label>
                  <Switch
                    id="push-reminders"
                    checked={settings.pushReminders !== null}
                    disabled={pushBusy}
                    onCheckedChange={(on) => void togglePush(on)}
                  />
                </div>
                {settings.pushReminders && (
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <Label htmlFor="push-detailed" className="text-sm">
                      Say "Period likely tomorrow" on the lock screen
                    </Label>
                    <Switch
                      id="push-detailed"
                      checked={settings.detailedReminderText}
                      onCheckedChange={(on) => void saveSettings({ detailedReminderText: on })}
                    />
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Otherwise it just says "Reminder". The server only knows when to send it, not what it says.
                </p>
                {pushError && (
                  <Alert className="mt-2">
                    <AlertDescription>{pushError}</AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </div>
        )}
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
