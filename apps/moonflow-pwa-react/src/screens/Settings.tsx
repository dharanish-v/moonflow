// src/screens/Settings.tsx — ported from screens/settings.js. Setting a new
// PIN (create-1/create-2) is its own route (PinSetup.tsx) — see that file
// for why.
import { forwardRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Calendar, Monitor, Moon, Sun } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { cn } from 'cn';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
import { Drawer, DrawerClose, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from '../components/ui/drawer';
import { Separator } from '../components/ui/separator';
import { Stepper } from '../components/Stepper';
import { Switch } from '../components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group';
import { BellIcon, ChevronRightIcon, DownloadIcon, DropletIcon, EyeOffIcon, LockIcon } from '../components/icons';
import { MAX_CYCLE_LENGTH, MAX_PERIOD_LENGTH, MIN_CYCLE_LENGTH, MIN_PERIOD_LENGTH } from '../lib/constants';
import { todayString } from '../lib/cycle-math';
import { setSetting } from '../lib/db';
import { buildExportPayload, exportFilename } from '../lib/export';
import type { ThemeMode } from '../lib/types';
import { useAppDispatch, useAppState } from '../state/store';

type EditField = 'avgCycleLength' | 'avgPeriodLength' | null;

const THEME_OPTIONS: ReadonlyArray<{ id: ThemeMode; label: string; Icon: typeof Sun }> = [
  { id: 'system', label: 'System', Icon: Monitor },
  { id: 'light', label: 'Light', Icon: Sun },
  { id: 'dark', label: 'Dark', Icon: Moon },
];

export function SettingsScreen() {
  const { settings, entries } = useAppState();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [discreetOpen, setDiscreetOpen] = useState(false);
  const [editField, setEditField] = useState<EditField>(null);
  const [draftValue, setDraftValue] = useState(0);

  async function handleThemeChange(mode: ThemeMode) {
    await setSetting('themeMode', mode);
    dispatch({ type: 'PATCH_SETTINGS', patch: { themeMode: mode } });
  }

  async function handleTogglePinLock(enabled: boolean) {
    if (!enabled) {
      await setSetting('pinLockEnabled', false);
      dispatch({ type: 'PATCH_SETTINGS', patch: { pinLockEnabled: false } });
      return;
    }
    if (settings.pinHash) {
      // Re-enabling after a prior disable — no need to set a new PIN.
      await setSetting('pinLockEnabled', true);
      dispatch({ type: 'PATCH_SETTINGS', patch: { pinLockEnabled: true } });
      return;
    }
    navigate({ to: '/settings/pin-setup' });
  }

  function openEdit(field: EditField, currentValue: number) {
    setDraftValue(currentValue);
    setEditField(field);
  }

  async function handleSaveEdit() {
    if (!editField) return;
    await setSetting(editField, draftValue);
    dispatch({
      type: 'PATCH_SETTINGS',
      patch: editField === 'avgCycleLength' ? { avgCycleLength: draftValue } : { avgPeriodLength: draftValue },
    });
    setEditField(null);
  }

  async function handleExport() {
    const json = buildExportPayload(entries, settings, new Date().toISOString());
    const file = new File([json], exportFilename(todayString()), { type: 'application/json' });

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Moonflow export' });
        return;
      } catch {
        // user cancelled the share sheet, or it failed — fall through to a plain download
      }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto box-border flex w-full max-w-[26rem] flex-1 flex-col px-4 py-5">
      <h1 className="mb-3.5 text-left text-base font-medium text-foreground">Settings</h1>

      <div className="mb-3.5">
        <span id="theme-label" className="mb-1.5 block text-xs text-muted-foreground">
          Appearance
        </span>
        <ToggleGroup
          type="single"
          value={settings.themeMode}
          onValueChange={(value) => {
            if (!value) return;
            void handleThemeChange(value as ThemeMode);
          }}
          aria-labelledby="theme-label"
          className="w-full gap-1.5"
        >
          {THEME_OPTIONS.map(({ id, label, Icon }) => (
            <ToggleGroupItem key={id} value={id} variant="pill" className="h-11 flex-1 gap-1 px-2">
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <Card className="gap-0 p-0 ring-border/60">
        <SettingsRow icon={<LockIcon className="size-4" />} label="App lock">
          <Switch checked={settings.pinLockEnabled} onCheckedChange={(v) => void handleTogglePinLock(v)} aria-label="App lock" />
        </SettingsRow>
        <Separator />
        <SettingsRow icon={<BellIcon className="size-4" />} label="Reminders">
          <Switch checked={false} disabled aria-label="Reminders" title="Coming in V2" />
        </SettingsRow>
        <Separator />
        <SettingsRowButton
          icon={<Calendar className="size-4" aria-hidden="true" />}
          label="Average cycle length"
          value={`${settings.avgCycleLength} days`}
          onClick={() => openEdit('avgCycleLength', settings.avgCycleLength)}
        />
        <Separator />
        <SettingsRowButton
          icon={<DropletIcon className="size-4" />}
          label="Average period length"
          value={`${settings.avgPeriodLength} days`}
          onClick={() => openEdit('avgPeriodLength', settings.avgPeriodLength)}
        />
        <Separator />
        <Collapsible open={discreetOpen} onOpenChange={setDiscreetOpen}>
          <CollapsibleTrigger asChild>
            <SettingsRowButton icon={<EyeOffIcon className="size-4" />} label="Discreet icon" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="px-3.5 pb-2 text-xs text-muted-foreground">
              To switch to a discreet home screen icon, remove Moonflow from your home screen, then open{' '}
              <a href="planner.html" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                the alternate install link
              </a>{' '}
              and add that to your home screen instead — same app, a neutral "Planner" icon.
            </p>
          </CollapsibleContent>
        </Collapsible>
        <Separator />
        <SettingsRowButton icon={<DownloadIcon className="size-4" />} label="Export data" onClick={() => void handleExport()} />
      </Card>

      <Drawer open={editField !== null} onOpenChange={(open) => { if (!open) setEditField(null); }}>
        <DrawerContent className="mx-auto max-w-[26rem] px-4 pb-5">
          <DrawerHeader className="px-0">
            <DrawerTitle>{editField === 'avgCycleLength' ? 'Average cycle length' : 'Average period length'}</DrawerTitle>
          </DrawerHeader>

          {editField && (
            <Stepper
              label={editField === 'avgCycleLength' ? 'Average cycle length' : 'Average period length'}
              value={draftValue}
              unit="days"
              min={editField === 'avgCycleLength' ? MIN_CYCLE_LENGTH : MIN_PERIOD_LENGTH}
              max={editField === 'avgCycleLength' ? MAX_CYCLE_LENGTH : MAX_PERIOD_LENGTH}
              onChange={setDraftValue}
            />
          )}

          <DrawerFooter className="px-0">
            <Button onClick={() => void handleSaveEdit()} className="h-11 w-full text-sm">
              Save
            </Button>
            <DrawerClose asChild>
              <Button variant="outline" className="h-11 w-full text-sm">
                Cancel
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function SettingsRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-2 px-3.5 py-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs text-foreground">{label}</span>
      </div>
      {children}
    </div>
  );
}

// forwardRef + a full props spread, not just the icon/label/value/onClick
// this needs on its own — it's also used as a Radix asChild trigger target
// (Settings' Discreet-icon row, via CollapsibleTrigger), which clones its
// own aria-expanded/aria-controls/data-state/ref onto whatever element sits
// here. A component that only destructures its own known props silently
// drops all of that — caught live: the row toggled open correctly (onClick
// made it through, since that was one of the destructured props) but
// aria-expanded stayed permanently absent from the DOM until this fix.
const SettingsRowButton = forwardRef<
  HTMLButtonElement,
  { icon: ReactNode; label: string; value?: string } & ComponentProps<typeof Button>
>(function SettingsRowButton({ icon, label, value, className, ...props }, ref) {
  return (
    <Button
      ref={ref}
      variant="ghost"
      aria-label={value ? `${label}, ${value}` : label}
      className={cn('h-11 w-full justify-between rounded-none px-3.5 text-left', className)}
      {...props}
    >
      <span className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs text-foreground">{label}</span>
      </span>
      <span className="flex items-center gap-1 text-muted-foreground">
        {value && <span className="text-xs">{value}</span>}
        <ChevronRightIcon className="size-4" />
      </span>
    </Button>
  );
});
