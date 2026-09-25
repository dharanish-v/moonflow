// Guards WCAG AA text contrast for the design tokens in src/index.css, in
// both themes. axe can't compute contrast for these (it can't resolve the
// runtime theme), so this checks the token pairs the UI actually uses.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..');
const css = readFileSync(path.join(ROOT, 'src/index.css'), 'utf8');

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1]!, m[2]!]));
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const PAIRS: Array<[fg: string, bg: string]> = [
  ['foreground', 'background'],
  ['foreground', 'card'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'card'],
  ['primary', 'background'],
  ['primary', 'card'],
  ['secondary', 'background'],
  ['secondary', 'card'],
  ['accent', 'card'],
  ['primary-foreground', 'primary'],
  ['secondary-foreground', 'secondary'],
  ['destructive-foreground', 'destructive'],
  ['card-foreground', 'card'],
  ['popover-foreground', 'popover'],
];

describe.each([
  ['dark (default)', ':root'],
  ['light', '.light'],
])('%s theme tokens', (_name, selector) => {
  const dark = block(':root');
  const tokens = { ...dark, ...block(selector) };

  it.each(PAIRS)('%s on %s meets WCAG AA (4.5:1)', (fg, bg) => {
    expect(tokens[fg], `--${fg} must be a hex token`).toBeDefined();
    expect(tokens[bg], `--${bg} must be a hex token`).toBeDefined();
    expect(contrast(tokens[fg]!, tokens[bg]!)).toBeGreaterThanOrEqual(4.5);
  });

  it('focus ring is at least 3:1 against the background (WCAG 1.4.11)', () => {
    expect(contrast(tokens.ring!, tokens.background!)).toBeGreaterThanOrEqual(3);
  });
});

describe('no faded text utilities', () => {
  it('never fades muted/foreground text with an opacity modifier (that is what failed AA)', async () => {
    const { execSync } = await import('node:child_process');
    const hits = execSync(`grep -rnoE "text-(muted-foreground|foreground)/[0-9]+" src --include=*.tsx || true`, {
      cwd: ROOT,
    }).toString();
    expect(hits).toBe('');
  });
});
