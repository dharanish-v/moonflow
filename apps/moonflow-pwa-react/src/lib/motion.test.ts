import { afterEach, describe, expect, it, vi } from 'vitest';
import { prefersReducedMotion, shake, withViewTransition } from './motion';

function mockReduced(reduced: boolean) {
  window.matchMedia = ((q: string) => ({ matches: reduced && q.includes('reduce'), addEventListener() {}, removeEventListener() {} })) as never;
}

describe('motion helpers (T87)', () => {
  afterEach(() => {
    delete (document as { startViewTransition?: unknown }).startViewTransition;
  });

  it('runs the update inside a view transition when supported', () => {
    mockReduced(false);
    const start = vi.fn((cb: () => void) => cb());
    (document as unknown as { startViewTransition: unknown }).startViewTransition = start;
    const update = vi.fn();
    withViewTransition(update);
    expect(start).toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('just runs the update when unsupported or when motion is reduced', () => {
    mockReduced(true);
    const start = vi.fn((cb: () => void) => cb());
    (document as unknown as { startViewTransition: unknown }).startViewTransition = start;
    const update = vi.fn();
    withViewTransition(update);
    expect(start).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
    delete (document as { startViewTransition?: unknown }).startViewTransition;
    mockReduced(false);
    withViewTransition(update);
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('shakes with the Web Animations API, and not at all under reduced motion', () => {
    const el = { animate: vi.fn() } as unknown as HTMLElement;
    mockReduced(false);
    shake(el);
    expect(el.animate).toHaveBeenCalledTimes(1);
    mockReduced(true);
    shake(el);
    expect(el.animate).toHaveBeenCalledTimes(1);
    expect(prefersReducedMotion()).toBe(true);
  });
});
