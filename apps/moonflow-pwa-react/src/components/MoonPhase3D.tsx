// src/components/MoonPhase3D.tsx — Phase 5's real 3D moon, additive on top
// of the already-working StaticMoonFallback (Phase 4's load-bearing
// rendering, and this component's own reduced-motion/no-WebGL2 fallback).
//
// A real SphereGeometry + one THREE.DirectionalLight positioned by the phase
// angle reproduces a correct terminator curve for free (real physics, not a
// hand-authored path) — reuses phaseToLightAngle()'s pure, unit-tested math.
// MeshToonMaterial with a small stepped gradient map, not MeshStandardMaterial
// — photoreal shading would read tonally wrong against this app's flat,
// opaque-everywhere product truth.
//
// Perf: frameloop="demand" + invalidate() only when phase changes, not a
// continuous 60fps loop the moon never needs; dpr capped at [1, 1.5], not
// R3F's own [1, 2] default; no shadow maps. This component is default-
// exported so Home.tsx can React.lazy() it — the whole point of scoping the
// three.js/R3F weight (~150-200KB gzipped) to only load for the users who
// can actually render it.
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { phaseToLightAngle } from '../lib/moon-phase';

const LIGHT_DISTANCE = 4;

function Scene({ phase }: { phase: number }) {
  const { invalidate } = useThree();
  const lightRef = useRef<THREE.DirectionalLight>(null);

  useEffect(() => {
    const { x, z } = phaseToLightAngle(phase);
    lightRef.current?.position.set(x * LIGHT_DISTANCE, 0, z * LIGHT_DISTANCE);
    invalidate();
  }, [phase, invalidate]);

  // A 3-step toon gradient (dark/mid/lit), not a smooth photoreal falloff.
  const gradientMap = useMemo(() => {
    const data = new Uint8Array([60, 150, 255]);
    const texture = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
    texture.needsUpdate = true;
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    return texture;
  }, []);

  return (
    <>
      <directionalLight ref={lightRef} intensity={2.4} />
      <ambientLight color="#2a2850" intensity={1.1} />
      <mesh>
        {/* radius 0.8, not 1 — at fov=35/z=3 the frustum's half-height is
            only ~0.95, so a full-radius sphere clipped flush against all
            four canvas edges (verified live: it rendered as a blocky
            rounded-square blob, not a circle, until this margin was added). */}
        <sphereGeometry args={[0.8, 48, 48]} />
        <meshToonMaterial color="#e8c874" gradientMap={gradientMap} />
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
      style={{ width: size, height: size }}
      dpr={[1, 1.5]}
      frameloop="demand"
      shadows={false}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, 0, 3], fov: 35 }}
    >
      <Scene phase={phase} />
    </Canvas>
  );
}

export default MoonPhase3D;
