// src/components/Ocean.tsx — ADR-035. A hand-written Gerstner-wave surface
// via a custom THREE.ShaderMaterial subclass (mirroring drei's own
// StarfieldMaterial pattern in @react-three/drei/core/Stars.js — a
// `<primitive object={material} attach="material" />`, not drei's
// `shaderMaterial()` + `extend()` + lowercase-JSX-tag convenience, which
// would need a JSX module augmentation this app has no other use for).
//
// Deliberately not three-stdlib's Water/Water2: real-time planar
// reflection needs a second mirrored render pass every frame, a real cost
// on top of everything else in this scene, and photoreal reflection would
// clash with the whole painterly/procedural direction anyway (the same
// reason the clouds are procedural canvas textures, not photos). Instead
// the fragment shader *fakes* it — a view-angle Fresnel blend toward the
// current mood's own glow color (the same value already tinting the
// moon/sun's glow sprite, so the water reads as lit by the same light)
// plus a fixed-direction specular glint.
//
// Real, honestly-flagged risk from the plan: this exact formula hadn't
// been hand-tested inside three.js before this file — verified live after
// writing it (screenshot check, not just "the API surface is real").
import { useFrame } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { GERSTNER_WAVES } from '../lib/gerstner-wave';
import type { PerfTier } from '../lib/perf-tier';

const OCEAN_SEGMENTS_BY_TIER: Record<PerfTier, number> = { low: 24, medium: 48, high: 96 };

// Composition constants — exported so Boat.tsx (and WorldScene.tsx, for
// anchor placement) can place boats on the exact same surface this mesh
// draws, via gerstner-wave.ts's oceanWorldHeight. Sized/placed so the
// ocean's near edge stays behind the cloud layer (nearest cloud at z=-3.5)
// and its horizon recedes toward the far clip plane, filling the lower
// portion of the frame under the moon/sun's hero composition.
export const OCEAN_Y = -1.8;
// Near edge deliberately close to the camera (world Z = OCEAN_Z + DEPTH/2 =
// +5, only 4 units in front of a camera at z=9) so the ocean fills the
// bottom of the frame like a real foreground, receding to a far edge
// (OCEAN_Z - DEPTH/2 = -45) that blends toward the horizon/sky rather than
// floating as a small, distant strip — the first build placed it entirely
// far away and it read as a thin ribbon with empty sky beneath it, caught
// live and corrected.
export const OCEAN_Z = -20;
const OCEAN_WIDTH = 40;
const OCEAN_DEPTH = 50;
const OCEAN_DEEP_COLOR = '#123a42';

const OCEAN_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uChop;
  uniform float uSpeed;
  uniform vec2 uWave0Dir;
  uniform float uWave0Len;
  uniform float uWave0Steep;
  uniform float uWave0Amp;
  uniform vec2 uWave1Dir;
  uniform float uWave1Len;
  uniform float uWave1Steep;
  uniform float uWave1Amp;
  uniform vec2 uWave2Dir;
  uniform float uWave2Len;
  uniform float uWave2Steep;
  uniform float uWave2Amp;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  // The standard GPU Gems 1 analytic Gerstner formula: horizontal
  // displacement peaks the wave crest toward a point (steepness), vertical
  // displacement is a plain sine, and the normal is the exact analytic
  // derivative of both — not a numerical/finite-difference approximation.
  void applyWave(vec2 dir, float wavelength, float steepness, float baseAmp, vec2 groundPos, inout vec3 pos, inout vec3 normal) {
    float k = 6.28318530718 / wavelength;
    float c = sqrt(9.8 / k) * uSpeed;
    float a = baseAmp * uChop;
    float f = k * (dot(dir, groundPos) - c * uTime);
    float cf = cos(f);
    float sf = sin(f);
    pos.x += steepness * a * dir.x * cf;
    pos.y += steepness * a * dir.y * cf;
    pos.z += a * sf;
    normal.x -= dir.x * k * a * cf;
    normal.y -= dir.y * k * a * cf;
    normal.z -= steepness * k * a * sf;
  }

  void main() {
    vec2 groundPos = position.xy;
    vec3 pos = vec3(position.x, position.y, 0.0);
    vec3 normal = vec3(0.0, 0.0, 1.0);

    applyWave(uWave0Dir, uWave0Len, uWave0Steep, uWave0Amp, groundPos, pos, normal);
    applyWave(uWave1Dir, uWave1Len, uWave1Steep, uWave1Amp, groundPos, pos, normal);
    applyWave(uWave2Dir, uWave2Len, uWave2Steep, uWave2Amp, groundPos, pos, normal);
    normal = normalize(normal);

    vec4 worldPos4 = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPos4.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);

    gl_Position = projectionMatrix * viewMatrix * worldPos4;
  }
`;

const OCEAN_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColorDeep;
  uniform vec3 uColorShallow;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    vec3 n = normalize(vNormal);
    float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
    vec3 base = mix(uColorDeep, uColorShallow, fresnel);

    // A fixed glint direction (matching the moon/sun's own hero-lit-from-
    // front convention) rather than real scene lighting — this shader
    // intentionally doesn't read the moon/sun's actual directional light.
    vec3 lightDir = normalize(vec3(0.3, 0.6, 0.4));
    vec3 halfDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(n, halfDir), 0.0), 60.0);
    vec3 color = base + uColorShallow * spec * 0.9;

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

class OceanMaterialImpl extends THREE.ShaderMaterial {
  constructor() {
    const uniforms: Record<string, { value: unknown }> = {
      uTime: { value: 0 },
      uChop: { value: 1 },
      uSpeed: { value: 1 },
      uColorDeep: { value: new THREE.Color(OCEAN_DEEP_COLOR) },
      uColorShallow: { value: new THREE.Color('#ffffff') },
    };
    GERSTNER_WAVES.forEach((wave, i) => {
      const len = Math.hypot(wave.direction[0], wave.direction[1]);
      uniforms[`uWave${i}Dir`] = { value: new THREE.Vector2(wave.direction[0] / len, wave.direction[1] / len) };
      uniforms[`uWave${i}Len`] = { value: wave.wavelength };
      uniforms[`uWave${i}Steep`] = { value: wave.steepness };
      uniforms[`uWave${i}Amp`] = { value: wave.amplitude };
    });
    super({ uniforms, vertexShader: OCEAN_VERTEX_SHADER, fragmentShader: OCEAN_FRAGMENT_SHADER });
  }
}

export interface OceanProps {
  perfTier: PerfTier;
  chop: number;
  speed: number;
  glowColor: string;
}

export function Ocean({ perfTier, chop, speed, glowColor }: OceanProps) {
  const [material] = useState(() => new OceanMaterialImpl());
  const segments = OCEAN_SEGMENTS_BY_TIER[perfTier];

  useEffect(() => {
    material.uniforms.uChop.value = chop;
  }, [material, chop]);
  useEffect(() => {
    material.uniforms.uSpeed.value = speed;
  }, [material, speed]);
  useEffect(() => {
    (material.uniforms.uColorShallow.value as THREE.Color).set(glowColor);
  }, [material, glowColor]);

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, OCEAN_Y, OCEAN_Z]}>
      <planeGeometry args={[OCEAN_WIDTH, OCEAN_DEPTH, segments, segments]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
