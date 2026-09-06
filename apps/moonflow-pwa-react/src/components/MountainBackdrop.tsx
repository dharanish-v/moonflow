// src/components/MountainBackdrop.tsx — ADR-035. Distant ridgelines as
// billboarded sprites (always face the camera, same primitive already
// proven correct for the moon's glow and cloud puffs), not real geometry —
// unlike Island.tsx, these never need true parallax (this scene's camera
// never orbits), so a flat silhouette is the cheaper, correct choice.
// Two layers at different depths/tints/opacities for a simple atmospheric-
// perspective read: the far ridge paler and hazier, the near one darker
// and more saturated, sitting just behind Ocean's horizon.
import { useMemo } from 'react';
import * as THREE from 'three';
import { createMountainRidgeTexture } from '../lib/cloud-texture';
import type { ResolvedTheme } from '../hooks/useResolvedTheme';

interface RidgeLayerProps {
  texture: THREE.Texture;
  color: string;
  opacity: number;
  position: [number, number, number];
  width: number;
  height: number;
}

function RidgeLayer({ texture, color, opacity, position, width, height }: RidgeLayerProps) {
  return (
    <sprite position={position} scale={[width, height, 1]}>
      <spriteMaterial map={texture} color={color} transparent opacity={opacity} depthWrite={false} />
    </sprite>
  );
}

export interface MountainBackdropProps {
  theme: ResolvedTheme;
}

const NIGHT_COLORS = { far: '#5f5a7c', near: '#241f38' };
const DAY_COLORS = { far: '#a8b8ad', near: '#4c5a48' };

export function MountainBackdrop({ theme }: MountainBackdropProps) {
  // Two independent textures (not one reused, scaled) — an identical
  // ridge silhouette repeated at two sizes would visibly read as the same
  // shape twice; each layer gets its own random peaks.
  const farTexture = useMemo(() => createMountainRidgeTexture(), []);
  const nearTexture = useMemo(() => createMountainRidgeTexture(), []);
  const colors = theme === 'light' ? DAY_COLORS : NIGHT_COLORS;

  // Both layers sit behind Ocean's far edge (world Z -45, see Ocean.tsx)
  // with a safe margin, not inside its span — the first build placed the
  // near ridge at z=-42 (inside the ocean's own footprint) and it either
  // z-fought with or was fully occluded by the opaque wave surface,
  // caught live and corrected. Modest height (base near the waterline,
  // peak reaching only to roughly the moon's own height) reads as distant
  // hills along the horizon rather than towering alps competing with the
  // moon/sun as the scene's hero.
  return (
    <>
      <RidgeLayer texture={farTexture} color={colors.far} opacity={0.6} position={[1.5, 0.1, -58]} width={52} height={6} />
      <RidgeLayer texture={nearTexture} color={colors.near} opacity={0.85} position={[-3, -0.4, -48]} width={40} height={5.5} />
    </>
  );
}
