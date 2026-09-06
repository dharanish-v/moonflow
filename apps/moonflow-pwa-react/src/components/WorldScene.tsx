// src/components/WorldScene.tsx — ADR-035. The app-wide persistent 3D
// scene: mounted exactly once, in AppGate.tsx, so it survives boot, lock,
// unlock, onboarding, and every route change untouched — no per-screen
// Canvas, no remount, no repeated "Context Lost" churn (the same failure
// mode this app already hit once from a Suspense unmount, ADR-033's own
// original HomeScene.tsx, now absorbed into this file and deleted).
//
// Fed two independent, privacy-gated inputs from AppGate.tsx:
// - `phase` — the moon's own phase, 0–1. Cycle-synced when real history
//   exists (cycle-moon-phase.ts, ADR-036), real astronomy otherwise — never
//   itself privacy-sensitive (real astronomy is just tonight's actual sky),
//   so it's safe to show even pre-unlock.
// - `cyclePhase` — the 5-state sky/weather mood (sky-mood.ts, untouched).
//   This one IS privacy-sensitive and arrives as 'unknown' whenever the app
//   isn't actually unlocked+onboarded yet.
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
// parent (#phone-frame, via AppGate.tsx). Sky/Stars' own defaults
// (distance=450000, radius=100) are tuned for full outdoor scenes and would
// render entirely outside this scene's unit scale (and this camera's far
// plane) regardless of aspect — both are scaled down to match; see the
// camera/Sky/Stars props below.
//
// Perf: frameloop is continuous ("always"), not "demand", since clouds
// drift and stars twinkle continuously while this is mounted — a real,
// accepted battery-cost tradeoff, now app-wide rather than Home-only
// (ADR-035's Consequences). prefers-reduced-motion freezes this back to
// "demand" — one static, fully mood-graded frame for the current
// cyclePhase, not a degraded state. Mood crossfades over
// MOOD_TRANSITION_SECONDS via lerpSkyMood, driving React state only while a
// transition is actually in flight (cheap: no per-frame re-render the rest
// of the time, since cyclePhase changes at most a few times a day).
import { Canvas, useFrame } from '@react-three/fiber';
import { Sky, Stars, useTexture } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import moonTextureUrl from '../assets/moon-2k.jpg';
import type { ResolvedTheme } from '../hooks/useResolvedTheme';
import { createCloudPuffTexture, createGlowTexture } from '../lib/cloud-texture';
import type { CyclePhase } from '../lib/home-status';
import { phaseToLightAngle } from '../lib/moon-phase';
import { lerpSkyMood, SKY_MOODS, type SkyMood } from '../lib/sky-mood';
import { SUN_MOODS } from '../lib/sun-mood';

const LIGHT_DISTANCE = 4;
const MOOD_TRANSITION_SECONDS = 2.5;
const SKY_DISTANCE = 60;
// Home's screen (and every other screen, now) is tall and narrow (a
// phone), not square like the old 150x150 canvas — the camera sits further
// back so the *horizontal* frustum (the narrower axis on a tall aspect
// ratio) still comfortably fits the moon, since PerspectiveCamera's fov is
// always the vertical angle regardless of container shape. Pushed up by
// MOON_OFFSET_Y so the moon sits in the upper portion of the frame (a hero
// composition with room below it for Home's own status text/buttons), not
// dead-center.
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

/** Crossfades toward moodTable[cyclePhase] over MOOD_TRANSITION_SECONDS,
 * snapping instantly under prefers-reduced-motion instead of animating.
 * moodTable is SKY_MOODS (night) or SUN_MOODS (day) — the *shape* of the
 * crossfade logic is identical for both, so it's a parameter here rather
 * than importing SKY_MOODS directly, per the confirmed decision to keep
 * the two tables data-separate while sharing all the rendering machinery. */
function useSkyMood(cyclePhase: CyclePhase, reducedMotion: boolean, moodTable: Record<CyclePhase, SkyMood>): SkyMood {
  const [mood, setMood] = useState<SkyMood>(() => moodTable[cyclePhase]);
  const moodRef = useRef(mood);
  moodRef.current = mood;
  const fromMoodRef = useRef<SkyMood>(mood);
  const toMoodRef = useRef<SkyMood>(mood);
  const transitionStartRef = useRef<number | null>(null);

  useEffect(() => {
    const target = moodTable[cyclePhase];
    if (reducedMotion) {
      transitionStartRef.current = null;
      setMood(target);
      return;
    }
    fromMoodRef.current = moodRef.current;
    toMoodRef.current = target;
    transitionStartRef.current = performance.now();
  }, [cyclePhase, reducedMotion, moodTable]);

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

/** The day-world's sun — deliberately simpler than Moon: no photo texture
 * (none needed or available), no phase/terminator (a sun doesn't have
 * "phases" the way a moon does — ADR-035 explicitly avoids inventing a fake
 * one), no external directional light shining on it (a sun is the light
 * source, not a lit object, so it uses an unlit meshBasicMaterial — always
 * fully bright regardless of scene lighting, the way a real sun looks).
 * Same hero position/glow-bridge technique as Moon, just self-luminous. */
function Sun({ glowColor, glowIntensity }: { glowColor: string; glowIntensity: number }) {
  const glowTexture = useMemo(() => createGlowTexture(glowColor), [glowColor]);

  return (
    <group position={[0, MOON_OFFSET_Y, 0]}>
      <ambientLight intensity={0.6} />
      <sprite position={[0, 0, -0.15]} scale={[3.2, 3.2, 1]}>
        <spriteMaterial
          map={glowTexture}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={glowIntensity}
        />
      </sprite>
      <mesh>
        <sphereGeometry args={[0.6, 32, 32]} />
        <meshBasicMaterial color="#fff6d8" />
      </mesh>
    </group>
  );
}

interface CloudSpriteProps {
  texture: THREE.Texture;
  color: string;
  opacity: number;
  speed: number;
  basePosition: [number, number, number];
  width: number;
}

/** A single drifting cloud puff — a plain alpha-blended sprite (the same
 * primitive already proven correct for the moon's own glow sprite), not
 * drei's volumetric <Cloud>. Drift is a slow sideways sine oscillation
 * driven by the clock, not React state — cheap, and naturally freezes under
 * prefers-reduced-motion since useFrame simply stops firing once the
 * Canvas drops to frameloop="demand". */
function CloudSprite({ texture, color, opacity, speed, basePosition, width }: CloudSpriteProps) {
  const ref = useRef<THREE.Sprite>(null);
  const driftRange = width * 0.18;
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.x = basePosition[0] + Math.sin(clock.elapsedTime * speed) * driftRange;
  });
  return (
    <sprite ref={ref} position={basePosition} scale={[width, width * 0.45, 1]}>
      <spriteMaterial map={texture} color={color} transparent opacity={opacity} depthWrite={false} />
    </sprite>
  );
}

function Scene({
  phase,
  cyclePhase,
  reducedMotion,
  theme,
}: {
  phase: number;
  cyclePhase: CyclePhase;
  reducedMotion: boolean;
  theme: ResolvedTheme;
}) {
  const moodTable = theme === 'light' ? SUN_MOODS : SKY_MOODS;
  const mood = useSkyMood(cyclePhase, reducedMotion, moodTable);
  // Computed once, not per mood change: the puff shape is neutral/white —
  // each sprite's own `color` below does the actual per-cloud tinting, so
  // regenerating this on every cyclePhase crossfade would be wasted work.
  const cloudTexture = useMemo(() => createCloudPuffTexture(), []);

  return (
    <>
      {theme === 'light' ? (
        <Sun glowColor={mood.glowColor} glowIntensity={mood.glowIntensity} />
      ) : (
        <Moon phase={phase} glowColor={mood.glowColor} glowIntensity={mood.glowIntensity} />
      )}
      <Sky
        distance={SKY_DISTANCE}
        inclination={mood.inclination}
        azimuth={mood.azimuth}
        turbidity={mood.turbidity}
        rayleigh={mood.rayleigh}
        mieCoefficient={mood.mieCoefficient}
        mieDirectionalG={mood.mieDirectionalG}
      />
      {/* drei's <Stars> uses its own hand-written StarfieldMaterial
          (@react-three/drei/core/Stars.js) whose fragment shader computes
          per-point alpha itself from `fade`/point-distance only — it never
          reads the material's own `opacity` property, so the
          `material-opacity` prop below is silently inert (verified against
          drei's real shipped source, not assumed — the same category of
          mistake this app already paid for once with drei's <Clouds>).
          Faking it as a real per-mood fade isn't possible without patching
          drei's shader, so this falls back to the coarser boolean the
          shader *can* honor: fully on for any mood that wants stars at all,
          fully off (unmounted, not just dimmed) for one that wants none —
          still correct for every current mood table (only exact-0 entries
          are SUN_MOODS' four states and SKY_MOODS.fertile). */}
      {mood.starOpacity > 0 && <Stars radius={30} depth={25} count={1000} factor={3} fade material-transparent />}
      <CloudSprite
        texture={cloudTexture}
        color={mood.cloudColor}
        opacity={mood.cloudOpacity}
        speed={mood.cloudSpeed}
        basePosition={[-2.4, MOON_OFFSET_Y + 0.9, -3.5]}
        width={3.2}
      />
      <CloudSprite
        texture={cloudTexture}
        color={mood.cloudColor}
        opacity={mood.cloudOpacity * 0.85}
        speed={mood.cloudSpeed * 0.7}
        basePosition={[2.6, MOON_OFFSET_Y - 0.7, -4.8]}
        width={4}
      />
      <CloudSprite
        texture={cloudTexture}
        color={mood.cloudColor}
        opacity={mood.cloudOpacity * 0.6}
        speed={mood.cloudSpeed * 0.5}
        basePosition={[0.4, MOON_OFFSET_Y - 2.6, -6]}
        width={4.6}
      />
    </>
  );
}

export interface WorldSceneProps {
  phase: number;
  cyclePhase: CyclePhase;
  theme: ResolvedTheme;
}

function WorldScene({ phase, cyclePhase, theme }: WorldSceneProps) {
  const reducedMotion = useReducedMotionPref();

  return (
    <Canvas
      aria-hidden="true"
      className="pointer-events-none -z-10"
      // Canvas's own default inline style sets position:relative — a plain
      // className="absolute inset-0" loses to that (inline style always
      // beats a CSS class, regardless of source order), so the canvas fell
      // back to a browser-default 300x150 raster instead of filling the
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
      {/* A Suspense boundary *inside* the Canvas, not just an outer one —
          useTexture() suspends too, and without this the texture's
          suspend/resolve cycle unmounts the whole Canvas (tearing down and
          recreating the WebGL context), which reliably crashed it with
          "Context Lost" (caught live). */}
      <Suspense fallback={null}>
        <Scene phase={phase} cyclePhase={cyclePhase} reducedMotion={reducedMotion} theme={theme} />
      </Suspense>
    </Canvas>
  );
}

export default WorldScene;
