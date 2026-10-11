import React, { useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { SCENE_ROOT, SceneFile } from './sceneFile';

// The ground of a scene without roads: grass, a concrete yard or paving.

const SIZE = 400;

export const Ground: React.FC<{ scene: SceneFile }> = ({ scene }) => {
  const kind = scene.ground?.kind ?? 'grass';
  const file = { grass: 'sparse_grass', concrete: 'concrete_floor_02', paving: 'concrete_pavers_02', earth: 'sparse_grass' }[kind];
  const tex = useTexture({ map: `${SCENE_ROOT}/textures/${file}_diff_1k.jpg`, normal: `${SCENE_ROOT}/textures/${file}_nor_1k.jpg` });
  const material = useMemo(() => {
    const repeat = SIZE / (kind === 'paving' ? 2.4 : 4);
    for (const t of [tex.map, tex.normal]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat, repeat);
      t.anisotropy = 8;
      t.needsUpdate = true;
    }
    tex.map.colorSpace = THREE.SRGBColorSpace;
    const tint = { grass: '#d9dccb', concrete: '#d6d4cf', paving: '#cfc8bd', earth: '#d9dccb' }[kind];
    return new THREE.MeshStandardMaterial({ map: tex.map, normalMap: tex.normal, roughness: 1, color: tint });
  }, [tex, kind]);
  // Indoor floors sit on a slab, so the ground is a step below them.
  const y = scene.setting?.kind === 'indoor' ? -0.15 : 0;
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={y} material={material} receiveShadow name="ground">
      <planeGeometry args={[SIZE, SIZE]} />
    </mesh>
  );
};
