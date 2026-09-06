// src/components/Rain.tsx — ADR-035. A single THREE.Points cloud of
// falling particles, position buffer mutated in place inside useFrame
// (clock-driven, not React state or setTimeout) — the same convention
// CloudSprite's own drift already established, so this freezes correctly
// under prefers-reduced-motion for free: WorldScene's Canvas drops to
// frameloop="demand" there, and useFrame simply stops firing.
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { PerfTier } from '../lib/perf-tier';

const RAIN_PARTICLES_BY_TIER: Record<PerfTier, number> = { low: 300, medium: 900, high: 2000 };

// A box roughly filling the near-camera foreground (camera sits at z=9,
// see WorldScene.tsx) — rain reads as falling in front of the whole
// scene, not confined to wherever the moon/ocean happen to be.
const RAIN_BOUNDS = { xHalf: 7, top: 6, bottom: -3, zNear: 6, zFar: -3 };
const FALL_SPEED = 9;

export interface RainProps {
  perfTier: PerfTier;
  intensity: number;
}

export function Rain({ perfTier, intensity }: RainProps) {
  const count = Math.max(1, Math.round(RAIN_PARTICLES_BY_TIER[perfTier] * intensity));

  // Rebuilt only when count itself changes (perfTier or intensity, i.e.
  // cyclePhase) — mutated in place every frame otherwise, not recreated.
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() * 2 - 1) * RAIN_BOUNDS.xHalf;
      arr[i * 3 + 1] = RAIN_BOUNDS.bottom + Math.random() * (RAIN_BOUNDS.top - RAIN_BOUNDS.bottom);
      arr[i * 3 + 2] = RAIN_BOUNDS.zFar + Math.random() * (RAIN_BOUNDS.zNear - RAIN_BOUNDS.zFar);
    }
    return arr;
  }, [count]);

  const pointsRef = useRef<THREE.Points>(null);

  useFrame((_state, delta) => {
    const geometry = pointsRef.current?.geometry;
    if (!geometry) return;
    const posAttr = geometry.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const yIdx = i * 3 + 1;
      arr[yIdx] -= FALL_SPEED * delta;
      if (arr[yIdx] < RAIN_BOUNDS.bottom) {
        arr[yIdx] = RAIN_BOUNDS.top;
        arr[i * 3] = (Math.random() * 2 - 1) * RAIN_BOUNDS.xHalf;
        arr[i * 3 + 2] = RAIN_BOUNDS.zFar + Math.random() * (RAIN_BOUNDS.zNear - RAIN_BOUNDS.zFar);
      }
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry key={count}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#cfe0ea" size={0.035} sizeAttenuation transparent opacity={0.55} depthWrite={false} />
    </points>
  );
}
