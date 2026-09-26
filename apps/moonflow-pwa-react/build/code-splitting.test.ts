// T62 — screens a user doesn't open on every launch load on demand.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (f: string) => readFileSync(path.resolve(import.meta.dirname, '../src', f), 'utf8');

describe('code splitting', () => {
  it.each(['Insights', 'Settings', 'Calendar', 'LogEntry', 'PinSetup', 'PinVerify', 'DuressSetup'])(
    'the %s screen is lazy-loaded by the router',
    (screen) => {
      const src = read('router/router.tsx');
      expect(src).not.toMatch(new RegExp(`import \\{ ${screen}Screen \\} from`));
      expect(src).toMatch(new RegExp(`import\\('../screens/${screen}'\\)`));
    },
  );

  it('onboarding (and its date-picker library) is lazy-loaded by the gate', () => {
    const src = read('router/AppGate.tsx');
    expect(src).not.toMatch(/import \{ OnboardingScreen \} from/);
    expect(src).toMatch(/lazy\(\(\) => import\('..\/screens\/Onboarding'\)/);
  });
});
