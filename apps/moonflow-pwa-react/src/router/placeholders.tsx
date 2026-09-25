// src/router/placeholders.tsx — boot-time screens shown before any real
// route can render: the loading splash, and the retry screen for a failed
// IndexedDB read (T37).
import { Button } from '../components/ui/button';

export function SplashScreen() {
  return <p className="m-auto text-sm text-muted-foreground">Loading…</p>;
}

export function BootErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-[26rem] flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-base font-medium text-foreground">Couldn't open your data</h1>
      <p className="text-sm text-muted-foreground">
        Nothing has been lost — your logs are still on this device. This is usually temporary.
      </p>
      <Button onClick={onRetry} className="h-11 w-full text-sm">
        Try again
      </Button>
    </div>
  );
}

/** Root route error boundary: any render crash lands here instead of a blank
 * or generic screen. Data lives in IndexedDB, untouched by a render error. */
export function AppErrorScreen() {
  return (
    <div className="mx-auto flex w-full max-w-[26rem] flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-base font-medium text-foreground">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">Your logs are safe on this device. Reloading usually fixes this.</p>
      <Button onClick={() => window.location.reload()} className="h-11 w-full text-sm">
        Reload
      </Button>
    </div>
  );
}
