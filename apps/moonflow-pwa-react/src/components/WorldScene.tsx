// src/components/WorldScene.tsx — ADR-035. The app-wide persistent 3D
// scene: mounted exactly once, in AppGate.tsx, so it survives boot, lock,
// unlock, onboarding, and every route change untouched — no per-screen
// Canvas, no remount, no repeated "Context Lost" churn (the same failure
// mode this app already hit once from a Suspense unmount, ADR-033's own
// HomeScene.tsx). Fed a privacy-gated `cyclePhase` — 'unknown' whenever the
// app isn't actually unlocked+onboarded yet, same reasoning that used to be
// encoded by *where* the old CycleSky component was mounted, now encoded in
// *what data* this component receives instead, since it renders behind the
// PIN lock screen too.
//
// Phase 3 skeleton only — a placeholder sphere, no real moon/sky content
// yet. Phase 4 absorbs HomeScene.tsx's Moon/CloudSprite/useSkyMood into
// this component; this phase exists purely to prove the mount-point/
// privacy-gate/no-remount architecture cheaply before investing in real
// content — see the plan file for why.
import { Canvas } from '@react-three/fiber';
import type { CyclePhase } from '../lib/home-status';

export interface WorldSceneProps {
  cyclePhase: CyclePhase;
}

const PLACEHOLDER_COLOR: Record<CyclePhase, string> = {
  period: '#d99fc0',
  follicular: '#9fb8e8',
  fertile: '#e8c874',
  luteal: '#e8a887',
  unknown: '#8f8db8',
};

function WorldScene({ cyclePhase }: WorldSceneProps) {
  return (
    <Canvas
      aria-hidden="true"
      className="pointer-events-none -z-10"
      // See HomeScene.tsx's own comment on this exact prop: Canvas's default
      // inline position:relative beats a plain className="absolute", so it
      // needs to be overridden via style, not just alongside it.
      style={{ position: 'absolute', inset: 0 }}
      dpr={[1, 1.5]}
      frameloop="always"
      shadows={false}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, 0, 9], fov: 35, near: 0.1, far: 150 }}
    >
      <ambientLight intensity={0.3} />
      <directionalLight position={[2, 2, 4]} intensity={1} />
      <mesh>
        <sphereGeometry args={[0.8, 32, 32]} />
        <meshStandardMaterial color={PLACEHOLDER_COLOR[cyclePhase]} />
      </mesh>
    </Canvas>
  );
}

export default WorldScene;
