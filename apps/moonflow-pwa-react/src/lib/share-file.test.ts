import { describe, expect, it, vi } from 'vitest';
import { shareOrDownload } from './share-file';

const file = new File(['{}'], 'x.json', { type: 'application/json' });

function deps(overrides: Partial<Parameters<typeof shareOrDownload>[2]> = {}) {
  return {
    share: vi.fn().mockResolvedValue(undefined),
    canShare: vi.fn().mockReturnValue(true),
    download: vi.fn(),
    ...overrides,
  };
}

describe('shareOrDownload', () => {
  it('uses the share sheet when files can be shared', async () => {
    const d = deps();
    expect(await shareOrDownload(file, 'T', d)).toBe('shared');
    expect(d.share).toHaveBeenCalledWith({ files: [file], title: 'T' });
    expect(d.download).not.toHaveBeenCalled();
  });

  it('treats a cancelled share sheet as cancelled — no surprise download', async () => {
    const d = deps({ share: vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError')) });
    expect(await shareOrDownload(file, 'T', d)).toBe('cancelled');
    expect(d.download).not.toHaveBeenCalled();
  });

  it('falls back to a download when sharing fails for a real reason', async () => {
    const d = deps({ share: vi.fn().mockRejectedValue(new DOMException('nope', 'NotAllowedError')) });
    expect(await shareOrDownload(file, 'T', d)).toBe('downloaded');
    expect(d.download).toHaveBeenCalledWith(file);
  });

  it('downloads directly when file sharing is unsupported', async () => {
    const d = deps({ share: undefined, canShare: undefined });
    expect(await shareOrDownload(file, 'T', d)).toBe('downloaded');
    expect(d.download).toHaveBeenCalledWith(file);
  });
});
