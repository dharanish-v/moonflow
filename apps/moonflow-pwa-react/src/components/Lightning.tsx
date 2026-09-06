// src/components/Lightning.tsx — ADR-035. A single PointLight that flashes
// on a Poisson process — inter-arrival times are exponentially distributed
// (mean = 60/frequency seconds), the standard model for "events happening
// at a steady average rate but at random, not evenly-spaced, moments" —
// real lightning doesn't strike on a metronome. Driven entirely by
// clock.elapsedTime inside useFrame (not setTimeout/React state), so it
// freezes correctly under prefers-reduced-motion along with everything
// else in the scene (WorldScene's Canvas drops to frameloop="demand"
// there) rather than a flash mid-transition getting stuck lit or dark.
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

const FLASH_DURATION_SECONDS = 0.18;
const FLASH_PEAK_INTENSITY = 14;

export interface LightningProps {
  /** Flashes per minute — callers only mount this component when > 0
   * (WEATHER_MOODS' own contract: 0 disables lightning entirely). */
  frequency: number;
}

export function Lightning({ frequency }: LightningProps) {
  const lightRef = useRef<THREE.PointLight>(null);
  const nextFlashAtRef = useRef<number | null>(null);
  const flashStartRef = useRef<number | null>(null);

  useFrame(({ clock }) => {
    const light = lightRef.current;
    if (!light) return;
    const t = clock.elapsedTime;
    const meanIntervalSeconds = 60 / frequency;

    if (nextFlashAtRef.current === null) {
      nextFlashAtRef.current = t + -Math.log(Math.random()) * meanIntervalSeconds;
    }
    if (flashStartRef.current === null && t >= nextFlashAtRef.current) {
      flashStartRef.current = t;
      nextFlashAtRef.current = t + -Math.log(Math.random()) * meanIntervalSeconds;
    }

    if (flashStartRef.current === null) {
      light.intensity = 0;
      return;
    }
    const elapsed = t - flashStartRef.current;
    if (elapsed >= FLASH_DURATION_SECONDS) {
      light.intensity = 0;
      flashStartRef.current = null;
      return;
    }
    // A squared-sine envelope (fast rise, fast fall) reads as a real
    // flash — a linear ramp down looks like a light dimming, not lightning.
    const progress = elapsed / FLASH_DURATION_SECONDS;
    light.intensity = FLASH_PEAK_INTENSITY * Math.sin(progress * Math.PI) ** 2;
  });

  return <pointLight ref={lightRef} position={[0, 6, -10]} color="#dce8ff" intensity={0} distance={70} decay={1} />;
}
