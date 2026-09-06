// src/components/Boat.tsx — ADR-035. A tiny fishing boat, procedural
// primitive geometry only (this app's whole asset philosophy — the moon's
// real photo texture is the one deliberate, licensed exception; see
// WorldScene.tsx's own file header). Bobs by sampling the *same* Gerstner
// surface Ocean.tsx's shader draws (gerstner-wave.ts's oceanWorldHeight),
// not an independent decorative sine, so it visibly rides real wave crests.
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { oceanWorldHeight } from '../lib/gerstner-wave';
import { OCEAN_Y, OCEAN_Z } from './Ocean';

// Small forward/side offsets used to finite-difference the wave surface's
// local slope each frame, so the boat pitches/rolls with the water instead
// of just bobbing straight up and down.
const SLOPE_SAMPLE_DISTANCE = 0.15;

export interface BoatProps {
  x: number;
  z: number;
  chop: number;
  speed: number;
  hullColor: string;
  sailColor: string;
}

export function Boat({ x, z, chop, speed, hullColor, sailColor }: BoatProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime;
    const yCenter = oceanWorldHeight(x, z, OCEAN_Y, OCEAN_Z, t, chop, speed);
    const yForward = oceanWorldHeight(x, z - SLOPE_SAMPLE_DISTANCE, OCEAN_Y, OCEAN_Z, t, chop, speed);
    const ySide = oceanWorldHeight(x + SLOPE_SAMPLE_DISTANCE, z, OCEAN_Y, OCEAN_Z, t, chop, speed);
    groupRef.current.position.y = yCenter;
    groupRef.current.rotation.x = Math.atan2(yForward - yCenter, SLOPE_SAMPLE_DISTANCE);
    groupRef.current.rotation.z = Math.atan2(ySide - yCenter, SLOPE_SAMPLE_DISTANCE);
  });

  return (
    <group ref={groupRef} position={[x, OCEAN_Y, z]}>
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[0.4, 0.12, 0.9]} />
        <meshStandardMaterial color={hullColor} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.3, 0.1]}>
        <cylinderGeometry args={[0.015, 0.015, 0.5, 6]} />
        <meshStandardMaterial color="#4a3728" roughness={0.9} />
      </mesh>
      <mesh position={[0.08, 0.38, 0.1]} rotation={[0, 0, -0.15]}>
        <planeGeometry args={[0.32, 0.36]} />
        <meshStandardMaterial color={sailColor} side={THREE.DoubleSide} roughness={0.95} />
      </mesh>
    </group>
  );
}
