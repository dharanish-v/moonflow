// T87 — framer-motion replaced by the platform: View Transitions, CSS, WAAPI.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = (f: string) => readFileSync(path.join(ROOT, f), 'utf8');

describe('motion without framer-motion', () => {
  it('framer-motion is not a dependency and not imported anywhere', () => {
    const pkg = JSON.parse(read('package.json'));
    expect({ ...pkg.dependencies, ...pkg.devDependencies }['framer-motion']).toBeUndefined();
    expect(execSync(`grep -rlnE "from ['\\"]framer-motion" src || true`, { cwd: ROOT }).toString()).toBe('');
  });

  it('route changes use view transitions', () => {
    expect(read('src/router/router.tsx')).toMatch(/defaultViewTransition: true/);
  });

  it('reduced motion switches off every animation and view transition', () => {
    const css = read('src/index.css');
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none !important[\s\S]*::view-transition-group\(\*\)/);
  });
});
