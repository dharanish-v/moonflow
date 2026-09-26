// T73 — the saved theme applies before first paint (no flash at launch).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = (f: string) => readFileSync(path.join(ROOT, f), 'utf8');

function boot(stored: string | null, prefersLight: boolean) {
  const classes = new Set<string>();
  const meta = { content: '' };
  runInNewContext(read('public/theme-boot.js'), {
    localStorage: { getItem: () => stored },
    matchMedia: () => ({ matches: prefersLight }),
    document: {
      documentElement: { style: {}, classList: { toggle: (c: string, on: boolean) => (on ? classes.add(c) : classes.delete(c)) } },
      querySelector: () => meta,
    },
  });
  return { light: classes.has('light'), themeColor: meta.content };
}

describe('theme boot script', () => {
  it('applies a forced light theme before React loads', () => {
    expect(boot('light', false)).toEqual({ light: true, themeColor: '#F7F5EF' });
  });
  it('applies a forced dark theme even when the OS prefers light', () => {
    expect(boot('dark', true)).toEqual({ light: false, themeColor: '#14132B' });
  });
  it('follows the OS when set to system or never set', () => {
    expect(boot(null, true).light).toBe(true);
    expect(boot('system', false).light).toBe(false);
  });
  it('is loaded synchronously in <head> of both entries, before the app bundle', () => {
    for (const f of ['index.html', 'planner.html']) {
      const html = read(f);
      expect(html).toMatch(/<script src="theme-boot\.js"><\/script>[\s\S]*<\/head>/);
      expect(html.indexOf('theme-boot.js')).toBeLessThan(html.indexOf('/src/main.tsx'));
    }
  });
});
