// src/components/MoonPhase3D.tsx — Phase 5's real 3D moon, additive on top
// of the already-working StaticMoonFallback (this component's own reduced-
// motion/no-WebGL2 fallback).
//
// Real photographic lunar surface texture (Solar System Scope's 2K equirect-
// angular map, itself built from NASA imagery/elevation data — CC BY 4.0,
// see src/assets/MOON-TEXTURE-LICENSE.txt) + MeshStandardMaterial, not a
// flat toon-shaded gold ball — the previous version read as a flat icon, not
// a real object, even with a correct terminator. The same texture doubles
// as a cheap bump map (its own luminance variation roughly tracks real
// maria/crater relief) since no separate official bump map exists for the
// Moon at this source.
//
// A real SphereGeometry + one THREE.DirectionalLight positioned by the phase
// angle reproduces a correct terminator curve for free (real physics, not a
// hand-authored path) — reuses phaseToLightAngle()'s pure, unit-tested math.
//
// Perf: frameloop="demand" + invalidate() only when phase changes, not a
// continuous 60fps loop the moon never needs; dpr capped at [1, 1.5], not
// R3F's own [1, 2] default; no shadow maps. Default-exported so Home.tsx can
// React.lazy() it — the whole point of scoping the three.js/R3F + texture
// weight to only load for users who can actually render it.
import { Canvas, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { Suspense, useEffect, useRef } from 'react';
import * as THREE from 'three';
import moonTextureUrl from '../assets/moon-2k.jpg';
import { phaseToLightAngle } from '../lib/moon-phase';

const LIGHT_DISTANCE = 4;

function Scene({ phase }: { phase: number }) {
  const { invalidate } = useThree();
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const texture = useTexture(moonTextureUrl);

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    invalidate();
  }, [texture, invalidate]);

  useEffect(() => {
    const { x, z } = phaseToLightAngle(phase);
    lightRef.current?.position.set(x * LIGHT_DISTANCE, 0, z * LIGHT_DISTANCE);
    invalidate();
  }, [phase, invalidate]);

  return (
    <>
      {/* Real sunlight is the only meaningful light source in space — low,
          cool ambient just keeps the dark side from crushing to pure black
          against this app's own dark UI, not simulating real fill light. */}
      <directionalLight ref={lightRef} intensity={3.2} color="#fff4e0" />
      <ambientLight intensity={0.18} />
      <mesh rotation={[0, -Math.PI / 2, 0]}>
        {/* radius 0.8, not 1 — at fov=35/z=3 the frustum's half-height is
            only ~0.95, so a full-radius sphere clips flush against all four
            canvas edges (verified live: it rendered as a blocky
            rounded-square blob, not a circle, until this margin was added). */}
        <sphereGeometry args={[0.8, 64, 64]} />
        <meshStandardMaterial map={texture} bumpMap={texture} bumpScale={0.015} roughness={1} metalness={0} />
      </mesh>
    </>
  );
}

export interface MoonPhase3DProps {
  phase: number;
  size?: number;
}

function MoonPhase3D({ phase, size = 150 }: MoonPhase3DProps) {
  return (
    <Canvas
      aria-hidden="true"
      className="mx-auto block"
      style={{ width: size, height: size }}
      dpr={[1, 1.5]}
      frameloop="demand"
      shadows={false}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, 0, 3], fov: 35 }}
    >
      {/* A Suspense boundary *inside* the Canvas, not just the outer one
          around React.lazy() in Home.tsx — useTexture() suspends too, and
          without this the texture's suspend/resolve cycle unmounts the
          whole Canvas (tearing down and recreating the WebGL context),
          which reliably crashed it with "Context Lost" (caught live). */}
      <Suspense fallback={null}>
        <Scene phase={phase} />
      </Suspense>
    </Canvas>
  );
}

export default MoonPhase3D;
