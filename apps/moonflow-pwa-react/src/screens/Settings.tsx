// src/screens/Settings.tsx — ported from screens/settings.js. Setting a new
// PIN (create-1/create-2) is its own route (PinSetup.tsx) — see that file
// for why.
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Calendar, Monitor, Moon, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Separator } from '../components/ui/separator';
import { Switch } from '../components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group';
import { BellIcon, ChevronRightIcon, DownloadIcon, DropletIcon, EyeOffIcon, LockIcon } from '../components/icons';
import { todayString } from '../lib/cycle-math';
import { setSetting } from '../lib/db';
import { buildExportPayload, exportFilename } from '../lib/export';
import type { ThemeMode } from '../lib/types';
import { useAppDispatch, useAppState } from '../state/store';

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
    navigate('/settings/pin-setup');
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

      {/* ADR-034: the app's day/night world (moon+night-sky vs. sun+day-sky)
          follows this choice, not just screen chrome — same signal, two
          consumers (see useResolvedTheme.ts and WorldScene). */}
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
          onClick={() => {}}
        />
        <Separator />
        <SettingsRowButton
          icon={<DropletIcon className="size-4" />}
          label="Average period length"
          value={`${settings.avgPeriodLength} days`}
          onClick={() => {}}
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
          To switch to a discreet home screen icon, remove Moonflow from your home screen and reinstall using the
          alternate link.
        </p>
      )}
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
