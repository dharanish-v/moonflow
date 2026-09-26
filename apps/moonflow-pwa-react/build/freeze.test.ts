// T95 — the finished-forever freeze: reproducible builds, documented data.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

describe('freeze', () => {
  it('pins every dependency to an exact version', () => {
    const all = { ...pkg.dependencies, ...pkg.devDependencies } as Record<string, string>;
    const loose = Object.entries(all).filter(([, v]) => !/^\d+\.\d+\.\d+$/.test(v));
    expect(loose).toEqual([]);
  });

  it('declares the Node version it builds with, and is version 1.0.0 or later', () => {
    expect(pkg.engines?.node).toBeTruthy();
    expect(pkg.version).toMatch(/^[1-9]\d*\.\d+\.\d+$/);
  });

  it('documents the data formats and the maintenance routine', () => {
    for (const f of ['../../docs/data-format.md', '../../docs/maintenance.md']) {
      expect(existsSync(path.join(ROOT, f)), f).toBe(true);
    }
    const df = readFileSync(path.join(ROOT, '../../docs/data-format.md'), 'utf8');
    for (const key of ['schemaVersion', 'moonflow-encrypted-backup', 'PBKDF2', 'AES-GCM', 'temperature', 'mucus', 'Temperature (°C)']) {
      expect(df, key).toContain(key);
    }
  });
});
