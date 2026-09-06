// src/components/HomeScene.tsx — Home's moon + sky, one shared scene
// (ADR-033). Formerly MoonPhase3D.tsx (Phase 5's real 3D moon) — grown into
// a full cinematic scene: drei's Sky/Stars/Cloud layered with the existing
// moon sphere+light, mood-graded per cyclePhase via sky-mood.ts. The moon's
// own real-astronomy phase (moon-phase.ts, ADR-019) is untouched and
// independent — phase and cyclePhase are two separate inputs driving two
// separate things in the same scene, not one system.
//
// Real photographic lunar surface texture (Solar System Scope's 2K equirect-
// angular map — CC BY 4.0, see src/assets/MOON-TEXTURE-LICENSE.txt) +
// MeshStandardMaterial for the moon. Clouds/glow use procedural canvas
// textures instead (cloud-texture.ts) — no external asset, no licensing
// question, and painterly/stylized on purpose (ADR-033) rather than
// photoreal, which would clash with the moon's own real-photo texture; the
// glow sprite behind the moon is the bridge between the two.
//
// Full-bleed, not a small square: the Canvas fills its whole positioned
// parent (Home.tsx's own container — see MOON_OFFSET_Y below for why this
// isn't just "make the canvas bigger" for free). Sky/Stars' own defaults
// (distance=450000, radius=100) are tuned for full outdoor scenes and would
// render entirely outside this scene's unit scale (and this camera's far
// plane) regardless of aspect — both are scaled down to match; see the
// camera/Sky/Stars props below.
//
// Perf: frameloop is continuous ("always"), not "demand" like the old
// moon-only version, since clouds drift and stars twinkle continuously
// while this is mounted — a real, accepted battery-cost tradeoff scoped to
// Home only (ADR-033's Consequences). prefers-reduced-motion freezes this
// back to "demand" — one static, fully mood-graded frame for the current
// cyclePhase, not a degraded state. Mood crossfades over
// MOOD_TRANSITION_SECONDS via lerpSkyMood, driving React state only while a
// transition is actually in flight (cheap: no per-frame re-render the rest
// of the time, since cyclePhase changes at most a few times a day).
import { Canvas, useFrame } from '@react-three/fiber';
import { Cloud, Sky, Stars, useTexture } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import moonTextureUrl from '../assets/moon-2k.jpg';
import { createCloudPuffTexture, createGlowTexture } from '../lib/cloud-texture';
import type { CyclePhase } from '../lib/home-status';
import { phaseToLightAngle } from '../lib/moon-phase';
import { lerpSkyMood, SKY_MOODS, type SkyMood } from '../lib/sky-mood';

const LIGHT_DISTANCE = 4;
const MOOD_TRANSITION_SECONDS = 2.5;
const SKY_DISTANCE = 60;
// Home's screen is tall and narrow (a phone), not square like the old
// 150x150 canvas — the camera sits further back so the *horizontal* frustum
// (the narrower axis on a tall aspect ratio) still comfortably fits the
// moon, since PerspectiveCamera's fov is always the vertical angle
// regardless of container shape. Pushed up by MOON_OFFSET_Y so the moon
// sits in the upper portion of the frame (a hero composition with room
// below it for Home's own status text/buttons), not dead-center.
const CAMERA_DISTANCE = 9;
const MOON_OFFSET_Y = 1.4;

function useReducedMotionPref(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/** Crossfades toward SKY_MOODS[cyclePhase] over MOOD_TRANSITION_SECONDS,
 * snapping instantly under prefers-reduced-motion instead of animating. */
function useSkyMood(cyclePhase: CyclePhase, reducedMotion: boolean): SkyMood {
  const [mood, setMood] = useState<SkyMood>(() => SKY_MOODS[cyclePhase]);
  const moodRef = useRef(mood);
  moodRef.current = mood;
  const fromMoodRef = useRef<SkyMood>(mood);
  const toMoodRef = useRef<SkyMood>(mood);
  const transitionStartRef = useRef<number | null>(null);

  useEffect(() => {
    const target = SKY_MOODS[cyclePhase];
    if (reducedMotion) {
      transitionStartRef.current = null;
      setMood(target);
      return;
    }
    fromMoodRef.current = moodRef.current;
    toMoodRef.current = target;
    transitionStartRef.current = performance.now();
  }, [cyclePhase, reducedMotion]);

  useFrame(() => {
    if (transitionStartRef.current === null) return;
    const elapsed = (performance.now() - transitionStartRef.current) / 1000;
    const t = elapsed / MOOD_TRANSITION_SECONDS;
    setMood(lerpSkyMood(fromMoodRef.current, toMoodRef.current, t));
    if (t >= 1) transitionStartRef.current = null;
  });

  return mood;
}

function Moon({ phase, glowColor, glowIntensity }: { phase: number; glowColor: string; glowIntensity: number }) {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const texture = useTexture(moonTextureUrl);
  const glowTexture = useMemo(() => createGlowTexture(glowColor), [glowColor]);

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
  }, [texture]);

  useEffect(() => {
    const { x, z } = phaseToLightAngle(phase);
    lightRef.current?.position.set(x * LIGHT_DISTANCE, 0, z * LIGHT_DISTANCE);
  }, [phase]);

  return (
    <group position={[0, MOON_OFFSET_Y, 0]}>
      {/* Real sunlight is the only meaningful light source in space — low,
          cool ambient just keeps the dark side from crushing to pure black
          against this app's own dark UI, not simulating real fill light. */}
      <directionalLight ref={lightRef} intensity={3.2} color="#fff4e0" />
      <ambientLight intensity={0.18} />
      {/* The glow sprite bridging the moon's photoreal texture into the
          stylized sky around it — see file header. Additive + no depth
          write so it never occludes the moon or clouds behind/in front. */}
      <sprite position={[0, 0, -0.15]} scale={[2.4, 2.4, 1]}>
        <spriteMaterial
          map={glowTexture}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={glowIntensity}
        />
      </sprite>
      <mesh rotation={[0, -Math.PI / 2, 0]}>
        <sphereGeometry args={[0.8, 64, 64]} />
        <meshStandardMaterial map={texture} bumpMap={texture} bumpScale={0.015} roughness={1} metalness={0} />
      </mesh>
    </group>
  );
}

function Scene({ phase, cyclePhase, reducedMotion }: { phase: number; cyclePhase: CyclePhase; reducedMotion: boolean }) {
  const mood = useSkyMood(cyclePhase, reducedMotion);
  const cloudTexture = useMemo(() => createCloudPuffTexture(mood.cloudColor), [mood.cloudColor]);

  return (
    <>
      <Moon phase={phase} glowColor={mood.glowColor} glowIntensity={mood.glowIntensity} />
      <Sky
        distance={SKY_DISTANCE}
        inclination={mood.inclination}
        azimuth={mood.azimuth}
        turbidity={mood.turbidity}
        rayleigh={mood.rayleigh}
        mieCoefficient={mood.mieCoefficient}
        mieDirectionalG={mood.mieDirectionalG}
      />
      <Stars radius={30} depth={25} count={1000} factor={3} fade material-opacity={mood.starOpacity} material-transparent />
      <Cloud
        texture={cloudTexture}
        color={mood.cloudColor}
        opacity={mood.cloudOpacity}
        speed={mood.cloudSpeed}
        position={[-2.4, MOON_OFFSET_Y + 0.9, -3.5]}
        scale={2.2}
      />
      <Cloud
        texture={cloudTexture}
        color={mood.cloudColor}
        opacity={mood.cloudOpacity * 0.85}
        speed={mood.cloudSpeed * 0.7}
        position={[2.6, MOON_OFFSET_Y - 0.7, -4.8]}
        scale={2.8}
      />
      <Cloud
        texture={cloudTexture}
        color={mood.cloudColor}
        opacity={mood.cloudOpacity * 0.6}
        speed={mood.cloudSpeed * 0.5}
        position={[0.4, MOON_OFFSET_Y - 2.6, -6]}
        scale={3.2}
      />
    </>
  );
}

export interface HomeSceneProps {
  phase: number;
  cyclePhase: CyclePhase;
}

function HomeScene({ phase, cyclePhase }: HomeSceneProps) {
  const reducedMotion = useReducedMotionPref();

  return (
    <Canvas
      aria-hidden="true"
      className="pointer-events-none -z-10"
      // Canvas's own default inline style sets position:relative — a plain
      // className="absolute inset-0" loses to that (inline style always
      // beats a CSS class, regardless of source order), so the canvas fell
      // back to a browser-default 300x150 raster instead of filling Home's
      // screen. An explicit style prop here overrides Canvas's own default
      // instead of merely adding alongside it (verified live: without this,
      // getComputedStyle reported position:relative and a 150px-tall
      // canvas, not the full-bleed background this needs to be).
      style={{ position: 'absolute', inset: 0 }}
      dpr={[1, 1.5]}
      frameloop={reducedMotion ? 'demand' : 'always'}
      shadows={false}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, 0, CAMERA_DISTANCE], fov: 35, near: 0.1, far: 150 }}
    >
      {/* A Suspense boundary *inside* the Canvas, not just an outer one
          around React.lazy() in Home.tsx — useTexture() suspends too, and
          without this the texture's suspend/resolve cycle unmounts the
          whole Canvas (tearing down and recreating the WebGL context),
          which reliably crashed it with "Context Lost" (caught live). */}
      <Suspense fallback={null}>
        <Scene phase={phase} cyclePhase={cyclePhase} reducedMotion={reducedMotion} />
      </Suspense>
    </Canvas>
  );
}

export default HomeScene;
