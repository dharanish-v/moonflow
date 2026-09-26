// Static a11y guarantees (T56) checked against source — they describe layout
// and motion behaviour jsdom can't render.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (f: string) => readFileSync(path.resolve(import.meta.dirname, '../src', f), 'utf8');

describe('accessibility (static)', () => {
  it('settings rows grow and wrap at large text sizes instead of clipping', () => {
    expect(read('screens/Settings.tsx')).toMatch(/min-h-11 w-full flex-wrap[^']*whitespace-normal/);
  });



  it('flow options wrap instead of clipping at large text sizes', () => {
    expect(read('screens/LogEntry.tsx')).toMatch(/aria-labelledby="log-flow-label"[\s\S]{0,400}className="w-full flex-wrap/);
  });
});
