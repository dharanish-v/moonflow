// src/lib/share-file.ts — Share Sheet first, plain download as fallback.
// Dependencies are injectable so the three outcomes stay unit-testable.

export type ShareOutcome = 'shared' | 'cancelled' | 'downloaded';

interface ShareDeps {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
  download: (file: File) => void;
}

/** Anchor-click download. The object URL is revoked on a delay — revoking
 * synchronously after click() can abort the download in Safari. */
export function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function browserDeps(): ShareDeps {
  return {
    share: navigator.share?.bind(navigator),
    canShare: navigator.canShare?.bind(navigator),
    download: downloadFile,
  };
}

export async function shareOrDownload(file: File, title: string, deps: ShareDeps = browserDeps()): Promise<ShareOutcome> {
  if (deps.share && deps.canShare?.({ files: [file] })) {
    try {
      await deps.share({ files: [file], title });
      return 'shared';
    } catch (err) {
      // Dismissing the sheet is a real user choice, not a failure to route around.
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    }
  }
  deps.download(file);
  return 'downloaded';
}
