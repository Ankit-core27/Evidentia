import { OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import type { PerspectiveCamera } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

import { SceneBuilder } from './SceneBuilder.js';
import type { SceneDefinition, SceneSelection } from './types/scene.js';

interface SceneCanvasProps {
  scene: SceneDefinition;
  selectedId: string | null;
  showEvidenceMarkers: boolean;
  showCeilings: boolean;
  resetVersion: number;
  overheadVersion: number;
  onObjectSelect?: (selection: SceneSelection) => void;
  onClearSelection?: () => void;
}

export function SceneCanvas({
  scene,
  selectedId,
  showEvidenceMarkers,
  showCeilings,
  resetVersion,
  overheadVersion,
  onObjectSelect,
  onClearSelection,
}: SceneCanvasProps) {
  const cameraPosition = scene.camera?.position ?? [8, 7, 9];
  const cameraTarget = scene.camera?.target ?? [0, 0.8, 0];
  const cameraSettings = useMemo(
    () => ({
      position: [...cameraPosition] as [number, number, number],
      target: [...cameraTarget] as [number, number, number],
      fov: scene.camera?.fov ?? 50,
      near: scene.camera?.near ?? 0.1,
      far: scene.camera?.far ?? 500,
    }),
    [cameraPosition, cameraTarget, scene.camera?.far, scene.camera?.fov, scene.camera?.near],
  );

  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 1.75]}
      camera={{
        position: cameraSettings.position,
        fov: cameraSettings.fov,
        near: cameraSettings.near,
        far: cameraSettings.far,
      }}
      gl={{ antialias: true, alpha: false }}
      onPointerMissed={onClearSelection}
    >
      <color attach="background" args={['#111827']} />
      <ambientLight intensity={1.15} />
      <directionalLight
        position={[7, 12, 5]}
        intensity={2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-7, 8, -5]} intensity={0.7} />
      <SceneCamera
        target={cameraSettings.target}
        position={cameraSettings.position}
        resetVersion={resetVersion}
        overheadVersion={overheadVersion}
      />
      <Suspense fallback={null}>
        <SceneBuilder
          scene={scene}
          selectedId={selectedId}
          showEvidenceMarkers={showEvidenceMarkers}
          showCeilings={showCeilings}
          onObjectSelect={onObjectSelect}
          onClearSelection={onClearSelection}
        />
      </Suspense>
    </Canvas>
  );
}

function SceneCamera({
  position,
  target,
  resetVersion,
  overheadVersion,
}: {
  position: [number, number, number];
  target: [number, number, number];
  resetVersion: number;
  overheadVersion: number;
}) {
  const controls = useRef<OrbitControlsImpl | null>(null);
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const { invalidate } = useThree();
  const lastReset = useRef(-1);
  const lastOverhead = useRef(overheadVersion);

  useEffect(() => {
    if (!controls.current || lastReset.current === resetVersion) return;
    lastReset.current = resetVersion;
    camera.position.set(...position);
    camera.lookAt(...target);
    controls.current.target.set(...target);
    controls.current.update();
    invalidate();
  }, [camera, invalidate, position, resetVersion, target]);

  useEffect(() => {
    if (!controls.current || lastOverhead.current === overheadVersion) return;
    lastOverhead.current = overheadVersion;
    camera.position.set(target[0], target[1] + 12, target[2] + 0.01);
    camera.lookAt(...target);
    controls.current.target.set(...target);
    controls.current.update();
    invalidate();
  }, [camera, invalidate, overheadVersion, target]);

  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.08} minDistance={1.5} maxDistance={80} />;
}
