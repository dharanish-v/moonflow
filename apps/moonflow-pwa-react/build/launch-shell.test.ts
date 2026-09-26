// T84 — something calm is on screen from the first frame, before any JS.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (f: string) => readFileSync(path.resolve(import.meta.dirname, '..', f), 'utf8');

describe('static launch shell', () => {
  it('index.html paints navy with the moon before the app loads', () => {
    const html = read('index.html');
    expect(html).toMatch(/<html[^>]*style="background:\s*#14132B"/);
    expect(html).toMatch(/<div id="root">[\s\S]*<svg[^>]*aria-hidden="true"[\s\S]*<\/div>/);
  });

  it('planner.html shows a neutral shell — no moon', () => {
    const html = read('planner.html');
    const root = html.slice(html.indexOf('<div id="root">'));
    expect(root).toMatch(/<svg/);
    expect(root).not.toMatch(/moon/i);
  });

  it('theme-boot also sets the first-frame background for the light theme', () => {
    expect(read('public/theme-boot.js')).toMatch(/style\.background/);
  });
});
