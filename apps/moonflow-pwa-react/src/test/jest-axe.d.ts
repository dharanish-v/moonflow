// @types/jest-axe only augments Jest's global namespace — this re-declares
// the same matcher against Vitest's own Assertion interface so
// `expect(...).toHaveNoViolations()` type-checks under `tsc -b`.
import 'vitest';

interface CustomMatchers<R = unknown> {
  toHaveNoViolations(): R;
}

declare module 'vitest' {
  interface Assertion<T = unknown> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
