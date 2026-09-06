// src/router/placeholders.tsx — SplashScreen is the only piece of Phase 2's
// original dumb-colored-div set still in play: a real boot-loading state has
// no richer content to show yet (IndexedDB hasn't resolved), so there's
// nothing for Phase 4 to replace it with.

export function SplashScreen() {
  return <p>Loading…</p>;
}
