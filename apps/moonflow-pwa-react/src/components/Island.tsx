// src/components/Island.tsx — ADR-035. Real, low-poly ExtrudeGeometry from
// a hand-authored 2D shape (this app's whole asset policy: procedural
// primitives, no external model imports — see WorldScene.tsx's own file
// header), flat-shaded rather than smooth — unlike MountainBackdrop's
// billboarded sprites, this is genuine 3D geometry, so it gets real depth
// and correct occlusion against the ocean and boats, not just a flat
// cutout. Sits directly at Ocean's water level, poking just above it.
import { useMemo } from 'react';
import * as THREE from 'three';
import { OCEAN_Y } from './Ocean';

const ISLAND_COLOR = '#b1c49e';
const SAND_COLOR = '#d6c0b7';

/** A hand-authored, slightly irregular island outline (not a perfect
 * ellipse — a real coastline is never a clean curve) built once from a
 * handful of control points around a circle with per-point radius jitter,
 * closed into a smooth loop via quadratic curves through midpoints, the
 * same "smooth a jagged point list" technique MountainBackdrop's ridge
 * texture already uses. */
function createIslandShape(): THREE.Shape {
  const pointCount = 9;
  const points: Array<[number, number]> = [];
  for (let i = 0; i < pointCount; i++) {
    const angle = (i / pointCount) * Math.PI * 2;
    const radius = 0.55 + Math.random() * 0.25;
    points.push([Math.cos(angle) * radius, Math.sin(angle) * radius * 0.75]);
  }

  const shape = new THREE.Shape();
  const [startX, startY] = points[0];
  shape.moveTo(startX, startY);
  for (let i = 1; i <= pointCount; i++) {
    const [prevX, prevY] = points[(i - 1) % pointCount];
    const [curX, curY] = points[i % pointCount];
    shape.quadraticCurveTo(prevX, prevY, (prevX + curX) / 2, (prevY + curY) / 2);
  }
  shape.closePath();
  return shape;
}

interface TreeProps {
  position: [number, number, number];
  scale: number;
}

/** A conifer-like tree — a cone (foliage) over a thin cylinder (trunk),
 * flat-shaded like the island itself so the two read as one consistent
 * low-poly world, not a smooth tree on a faceted rock. */
function Tree({ position, scale }: TreeProps) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.015, 0.02, 0.16, 5]} />
        <meshStandardMaterial color="#5a4632" flatShading roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <coneGeometry args={[0.11, 0.28, 6]} />
        <meshStandardMaterial color="#4f6b3f" flatShading roughness={0.85} />
      </mesh>
    </group>
  );
}

export interface IslandProps {
  x: number;
  z: number;
  scale?: number;
}

export function Island({ x, z, scale = 1 }: IslandProps) {
  const shape = useMemo(() => createIslandShape(), []);
  const geometry = useMemo(
    () => new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: false }),
    [shape],
  );
  // Fixed tree anchors within the island's own local footprint — placed by
  // hand rather than randomly scattered, so none end up outside the shape
  // or stacked on top of one another.
  const trees: ReadonlyArray<[number, number, number]> = [
    [-0.15, 0.22, 0.1],
    [0.1, 0.22, -0.12],
    [0.22, 0.22, 0.15],
  ];

  return (
    <group position={[x, OCEAN_Y + 0.02, z]} scale={scale}>
      <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color={ISLAND_COLOR} flatShading roughness={0.95} />
      </mesh>
      {/* A thin sand-colored disc just beneath the green cap, reading as a
          shoreline ring where the island meets the water. */}
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={1.08}>
        <circleGeometry args={[0.6, 24]} />
        <meshStandardMaterial color={SAND_COLOR} flatShading roughness={1} />
      </mesh>
      {trees.map((pos, i) => (
        <Tree key={i} position={pos} scale={0.9 + (i % 2) * 0.2} />
      ))}
    </group>
  );
}
