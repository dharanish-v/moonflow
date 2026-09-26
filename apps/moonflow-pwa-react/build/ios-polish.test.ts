// iOS-specific CSS guarantees (T45) that jsdom can't observe at runtime.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..');
const css = readFileSync(path.join(ROOT, 'src/index.css'), 'utf8');
const read = (f: string) => readFileSync(path.join(ROOT, f), 'utf8');

describe('iOS polish', () => {
  it('removes the grey tap flash and double-tap zoom on controls', () => {
    expect(css).toMatch(/-webkit-tap-highlight-color:\s*transparent/);
    expect(css).toMatch(/touch-action:\s*manipulation/);
  });

  it('paints a dark band under the status bar in the light theme so white status-bar text stays readable', () => {
    expect(css).toMatch(/\.light #phone-frame::before/);
  });

  it('both entries use the translucent status bar (content-under-status-bar layout is designed for it)', () => {
    for (const f of ['index.html', 'planner.html']) {
      expect(read(f)).toMatch(/apple-mobile-web-app-status-bar-style" content="black-translucent"/);
    }
  });

  it('the tab bar keeps a gap above the screen edge even with no safe-area inset', () => {
    expect(read('src/components/TabBar.tsx')).toMatch(/calc\(env\(safe-area-inset-bottom,0px\)\+0\.5rem\)/);
  });

  it('no form field is shrunk below 16px (iOS zooms the page on focus)', () => {
    const offenders = ['src/screens/LogEntry.tsx', 'src/components/PinEntryForm.tsx', 'src/screens/Onboarding.tsx']
      .map((f) => [f, read(f)] as const)
      .flatMap(([f, src]) => [...src.matchAll(/<(Textarea|Input)\b[^>]*className="([^"]*)"/g)].filter((m) => /(^|\s)text-(xs|sm)\b/.test(m[2]!)).map(() => f));
    expect(offenders).toEqual([]);
  });
});

describe('glass sheets stay legible', () => {
  it('keeps the drawer at least 95% opaque — blur may not render behind a transformed sheet in WebKit', () => {
    const src = readFileSync(path.join(ROOT, 'src/components/ui/drawer.tsx'), 'utf8');
    const m = src.match(/bg-popover\/(\d+)/);
    expect(m && Number(m[1])).toBeGreaterThanOrEqual(95);
  });
});
