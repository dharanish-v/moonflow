// src/lib/install-identity.ts — which of the two front doors (ADR-011) loaded
// this app. planner.html is the discreet install; anything user-visible that
// would name "Moonflow" (filenames, share titles, headings) checks this.
export function isDiscreetInstall(pathname: string = window.location.pathname): boolean {
  return pathname.endsWith('planner.html');
}
