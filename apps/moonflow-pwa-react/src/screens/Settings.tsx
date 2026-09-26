// src/screens/Settings.tsx — ported from screens/settings.js. Setting a new
// PIN (create-1/create-2) is its own route (PinSetup.tsx) — see that file
// for why.
import { forwardRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Calendar, Info, Monitor, Moon, ShieldAlert, Sun, Upload } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { cn } from 'cn';
import { Alert, AlertDescription } from '../components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
import { Drawer, DrawerClose, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from '../components/ui/drawer';
import { Separator } from '../components/ui/separator';
import { Stepper } from '../components/Stepper';
import { Switch } from '../components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group';
import { ChevronRightIcon, DownloadIcon, DropletIcon, EyeOffIcon, LockIcon } from '../components/icons';
import { MAX_CYCLE_LENGTH, MAX_PERIOD_LENGTH, MIN_CYCLE_LENGTH, MIN_PERIOD_LENGTH } from '../lib/constants';
import { eraseAllData } from '../lib/db';
import { useSaveSettings } from '../state/useSaveSettings';
import { isDiscreetInstall } from '../lib/install-identity';
import { lastBackupLabel } from '../lib/backup-nudge';
import { ExportSheet } from '../components/ExportSheet';
import { ImportBackup } from '../components/ImportBackup';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import type { Settings, ThemeMode } from '../lib/types';
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
  const [dataMoveOpen, setDataMoveOpen] = useState(false);
  const [editField, setEditField] = useState<EditField>(null);
  const [draftValue, setDraftValue] = useState(0);
  const [saveError, setSaveError] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [removeDuressOpen, setRemoveDuressOpen] = useState(false);
  const [eraseOpen, setEraseOpen] = useState(false);
  const [eraseConfirm, setEraseConfirm] = useState('');
  const saveSettingsPatch = useSaveSettings();

  async function persist(patch: Partial<Settings>): Promise<boolean> {
    setSaveError(false);
    const ok = await saveSettingsPatch(patch);
    if (!ok) setSaveError(true);
    return ok;
  }

  async function handleThemeChange(mode: ThemeMode) {
    await persist({ themeMode: mode });
  }

  // Turning the lock off needs the current PIN (anyone holding the unlocked
  // phone could otherwise disable it for good). Turning it on always sets a
  // fresh PIN — silently reviving one set months ago locked people out of
  // their own data at the next relock.
  function handleTogglePinLock(enabled: boolean) {
    if (!enabled) {
      navigate({ to: '/settings/pin-verify', search: { intent: 'disable' } });
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
    const ok = await persist(editField === 'avgCycleLength' ? { avgCycleLength: draftValue } : { avgPeriodLength: draftValue });
    if (ok) setEditField(null);
  }

  async function handleEraseAll() {
    const ok = await eraseAllData();
    setEraseOpen(false);
    setEraseConfirm('');
    if (!ok) {
      setSaveError(true);
      return;
    }
    // Re-read the now-empty database: AppGate lands on onboarding.
    dispatch({ type: 'BOOT_RETRY' });
  }

  return (
    <div className="mx-auto box-border flex w-full max-w-[26rem] flex-1 flex-col px-4 py-5">
      <h1 className="mb-3.5 text-left text-base font-medium text-foreground">Settings</h1>

      <div className="mb-3.5">
        <span id="theme-label" className="mb-1.5 block text-sm text-muted-foreground">
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
            <ToggleGroupItem key={id} value={id} variant="segment" className="h-11 flex-1 gap-1 px-2">
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <Card className="gap-0 p-0 ring-border/60">
        <SettingsRow icon={<LockIcon className="size-4" />} label="App lock">
          <Switch checked={settings.pinLockEnabled} onCheckedChange={handleTogglePinLock} aria-label="App lock" />
        </SettingsRow>
        {settings.pinLockEnabled && (
          <>
            <Separator />
            <SettingsRowButton
              icon={<LockIcon className="size-4" />}
              label="Change PIN"
              onClick={() => navigate({ to: '/settings/pin-verify', search: { intent: 'change' } })}
            />
            <Separator />
            <SettingsRowButton
              icon={<ShieldAlert className="size-4" aria-hidden="true" />}
              label="Duress PIN"
              value={settings.duressPinHash ? 'On' : 'Off'}
              onClick={() => (settings.duressPinHash ? setRemoveDuressOpen(true) : navigate({ to: '/settings/duress-setup' }))}
            />
          </>
        )}
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
        <p className="px-3.5 pb-2 text-xs text-muted-foreground">
          Used for predictions until you've logged two cycles — after that, your own history takes over.
        </p>
        <Separator />
        {!isDiscreetInstall() && (
          <>
        <Collapsible open={discreetOpen} onOpenChange={setDiscreetOpen}>
          <CollapsibleTrigger asChild>
            <SettingsRowButton icon={<EyeOffIcon className="size-4" />} label="Discreet icon" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="px-3.5 pb-2 text-xs text-muted-foreground">
              To switch to a discreet home screen icon, remove this app from your home screen, then open{' '}
              <a href="planner.html" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                the alternate install link
              </a>{' '}
              and add that to your home screen instead — same app, a neutral "Planner" icon.
            </p>
          </CollapsibleContent>
        </Collapsible>
            <Separator />
          </>
        )}
        <SettingsRowButton icon={<DownloadIcon className="size-4" />} label="Export data" value={lastBackupLabel(settings.lastBackupAt, Date.now())} onClick={() => setExportOpen(true)} />
        <Separator />
        <ImportBackup>
          {(pick) => (
            <SettingsRowButton icon={<Upload className="size-4" aria-hidden="true" />} label="Import data" onClick={pick} />
          )}
        </ImportBackup>
        <Separator />
        <Collapsible open={dataMoveOpen} onOpenChange={setDataMoveOpen}>
          <CollapsibleTrigger asChild>
            <SettingsRowButton icon={<Info className="size-4" aria-hidden="true" />} label="Moving data to another device" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="px-3.5 pb-2 text-xs text-muted-foreground">
              Export creates a file — send it to your other device however you'd send any file (AirDrop, email,
              messaging app), then open Settings there and tap Import to bring it in.
            </p>
            <p className="px-3.5 pb-2 text-xs text-muted-foreground">
              Your logs live only on this phone. Removing the app from your home screen deletes everything, and each
              home-screen icon keeps its own separate data — so keep a recent backup.
            </p>
          </CollapsibleContent>
        </Collapsible>
      </Card>



      {saveError && (
        <Alert className="mt-3.5">
          <AlertDescription>Couldn't save — try again</AlertDescription>
        </Alert>
      )}



      <Button
        variant="ghost"
        onClick={() => setEraseOpen(true)}
        className="mt-3.5 h-11 w-full text-sm text-destructive"
      >
        Erase all data
      </Button>

      <p className="mt-5 text-center text-xs text-muted-foreground">
        Predictions are estimates from your own logs. This app is not a medical device, can't diagnose anything, and must
        never be used as birth control.
      </p>

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

      <AlertDialog open={removeDuressOpen} onOpenChange={setRemoveDuressOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove duress PIN?</AlertDialogTitle>
            <AlertDialogDescription>
              The duress PIN opens an empty decoy instead of your real data. Removing it means only your real PIN works.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => void persist({ duressPinHash: null })}>Remove</AlertDialogAction>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={eraseOpen}
        onOpenChange={(open) => {
          setEraseOpen(open);
          if (!open) setEraseConfirm('');
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Erase all data?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes every log and setting on this device. It can't be undone — export a backup first if
              you might want it back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Label htmlFor="erase-confirm" className="text-sm">
            Type ERASE to confirm
          </Label>
          <Input
            id="erase-confirm"
            autoCapitalize="characters"
            autoComplete="off"
            value={eraseConfirm}
            onChange={(e) => setEraseConfirm(e.target.value)}
            className="h-11"
          />
          <AlertDialogFooter>
            <Button
              variant="destructive"
              disabled={eraseConfirm.trim().toUpperCase() !== 'ERASE'}
              onClick={() => void handleEraseAll()}
              className="h-11 w-full text-sm"
            >
              Erase everything
            </Button>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ExportSheet
        open={exportOpen}
        onOpenChange={setExportOpen}
        entries={entries}
        settings={settings}
        onExported={() => void persist({ lastBackupAt: Date.now() })}
      />




    </div>
  );
}

function SettingsRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-2 px-3.5 py-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm text-foreground">{label}</span>
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
      className={cn('h-auto min-h-11 w-full flex-wrap justify-between gap-y-1 rounded-none px-3.5 py-2 text-left whitespace-normal', className)}
      {...props}
    >
      <span className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm text-foreground">{label}</span>
      </span>
      <span className="flex items-center gap-1 text-muted-foreground">
        {value && <span className="text-xs">{value}</span>}
        <ChevronRightIcon className="size-4" />
      </span>
    </Button>
  );
});
