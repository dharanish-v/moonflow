// T57 — text follows the iOS text-size setting, and body text isn't 12px.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..');
const css = readFileSync(path.join(ROOT, 'src/index.css'), 'utf8');

describe('Dynamic Type', () => {
  it('sizes the root font from the iOS text-size setting', () => {
    expect(css).toMatch(/html\s*\{[^}]*font:\s*-apple-system-body/);
  });

  it('keeps our font family after the font shorthand resets it', () => {
    expect(css).toMatch(/font:\s*-apple-system-body;[\s\S]{0,80}font-family:\s*var\(--font-sans\)/);
  });

  it('never uses px font sizes (they would ignore Dynamic Type)', () => {
    const hits = execSync(`grep -rnoE "text-\\[[0-9.]+px\\]" src || true`, { cwd: ROOT }).toString();
    expect(hits).toBe('');
  });

  it('body text and field labels are at least text-sm', () => {
    const hits = execSync(`grep -rnoE "text-xs text-foreground|block text-xs text-muted-foreground" src/screens src/components || true`, { cwd: ROOT }).toString();
    expect(hits).toBe('');
  });
});
