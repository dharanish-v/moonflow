import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('workbox config (T77)', () => {
  it('does not skip waiting on its own — the user decides when to update', () => {
    const cfg = readFileSync(path.resolve(import.meta.dirname, '../vite.config.ts'), 'utf8');
    expect(cfg).toMatch(/skipWaiting: false/);
    expect(cfg).not.toMatch(/skipWaiting: true/);
  });
});
