// @ts-check
// motion.js — shared reduced-motion state for every GSAP-driven animation in
// the app (replaces the old plain `prefers-reduced-motion` CSS media query
// now that these animations are JS-driven, not CSS keyframes). A single
// gsap.matchMedia() instance keeps this live: if the OS setting changes
// while the app is open, `prefersReducedMotion()` reflects it immediately,
// same as the CSS media query always did.

import gsap from 'gsap';

let reduced = false;

gsap.matchMedia().add('(prefers-reduced-motion: reduce)', () => {
  reduced = true;
  return () => { reduced = false; };
});

export function prefersReducedMotion() {
  return reduced;
}
