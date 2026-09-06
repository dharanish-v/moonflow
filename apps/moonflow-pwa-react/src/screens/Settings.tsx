// src/screens/Settings.tsx — ported from screens/settings.js. Setting a new
// PIN (create-1/create-2) is its own route (PinSetup.tsx) — see that file
// for why.
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Calendar, Monitor, Moon, Sun } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
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
    <div className="mx-auto box-border flex w-full max-w-[26rem] flex-1 flex-col px-flow-5 py-flow-6">
      <h1 className="mb-flow-4 text-left text-flow-title font-medium text-foreground">Settings</h1>

      <div className="mb-flow-4">
        <span id="theme-label" className="mb-flow-2 block text-flow-caption text-muted-foreground">
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
          className="w-full gap-flow-2"
        >
          {THEME_OPTIONS.map(({ id, label, Icon }) => (
            <ToggleGroupItem key={id} value={id} variant="pill" className="h-11 flex-1 gap-flow-1 px-2">
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
        <SettingsRowButton
          icon={<EyeOffIcon className="size-4" />}
          label="Discreet icon"
          onClick={() => setDiscreetOpen((v) => !v)}
          expanded={discreetOpen}
        />
        <Separator />
        <SettingsRowButton icon={<DownloadIcon className="size-4" />} label="Export data" onClick={() => void handleExport()} />
      </Card>

      {discreetOpen && (
        <p className="mt-flow-2 text-flow-micro text-muted-foreground">
          To switch to a discreet home screen icon, remove Moonflow from your home screen, then open{' '}
          <a href="planner.html" target="_blank" rel="noopener noreferrer" className="text-primary underline">
            the alternate install link
          </a>{' '}
          and add that to your home screen instead — same app, a neutral "Planner" icon.
        </p>
      )}

      <Drawer open={editField !== null} onOpenChange={(open) => { if (!open) setEditField(null); }}>
        <DrawerContent className="mx-auto max-w-[26rem] px-flow-5 pb-flow-6">
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
            <Button onClick={() => void handleSaveEdit()} className="h-11 w-full text-flow-nav">
              Save
            </Button>
            <DrawerClose asChild>
              <Button variant="outline" className="h-11 w-full text-flow-nav">
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
    <div className="flex min-h-11 items-center justify-between gap-flow-3 px-flow-4 py-3">
      <div className="flex items-center gap-flow-3 text-muted-foreground">
        {icon}
        <span className="text-flow-body text-foreground">{label}</span>
      </div>
      {children}
    </div>
  );
}

function SettingsRowButton({
  icon,
  label,
  value,
  expanded,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value?: string;
  expanded?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      aria-label={value ? `${label}, ${value}` : label}
      aria-expanded={expanded}
      className="h-11 w-full justify-between rounded-none px-flow-4 text-left"
    >
      <span className="flex items-center gap-flow-3 text-muted-foreground">
        {icon}
        <span className="text-flow-body text-foreground">{label}</span>
      </span>
      <span className="flex items-center gap-flow-1 text-muted-foreground">
        {value && <span className="text-flow-body">{value}</span>}
        <ChevronRightIcon className="size-4" />
      </span>
    </Button>
  );
}
