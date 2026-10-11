import React, { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { ModelBoundary } from './Props';
import { JointName, POSES } from './poses';
import { SCENE_ROOT } from './sceneFile';

// People as a posable forensic mannequin: one articulated model whose joints take a
// pose from poses.ts. A neutral figure says where someone was and how they stood,
// without suggesting what they looked like.

export const PERSON_URL = `${SCENE_ROOT}/library/person.glb`;

/** Where a rider sits, in the vehicle's frame: the pose and the offset of the figure's origin. */
export const RIDER: Record<string, { pose: string; offset: [number, number, number] }> = {
  bicycle: { pose: 'cycling', offset: [-0.05, 0, 0] },
  motorcycle: { pose: 'riding', offset: [-0.1, 0, 0] }
};

export const Person: React.FC<{ pose?: string; url?: string; clothing?: string }> = ({ pose = 'standing', url = PERSON_URL, clothing }) => {
  const fallback = <StandIn pose={pose} />;
  return (
    <ModelBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <Mannequin url={url} pose={pose} clothing={clothing} />
      </Suspense>
    </ModelBoundary>
  );
};

const Mannequin: React.FC<{ url: string; pose: string; clothing?: string }> = ({ url, pose, clothing }) => {
  const gltf = useGLTF(url);
  const root = useMemo(() => {
    const r = gltf.scene.clone(true);
    r.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (clothing && mat?.name === 'top') {
        mesh.material = mat.clone();
        (mesh.material as THREE.MeshStandardMaterial).color.set(clothing);
      }
    });
    const spec = POSES[pose] ?? POSES.standing;
    for (const [name, rotation] of Object.entries(spec.joints) as [JointName, [number, number, number]][]) {
      const joint = r.getObjectByName(name);
      if (joint) joint.rotation.set(...rotation);
    }
    if (spec.drop) {
      const pelvis = r.getObjectByName('pelvis');
      if (pelvis) pelvis.position.y += spec.drop;
    }
    return r;
  }, [gltf, pose, clothing]);
  return <primitive object={root} />;
};

const SKIN = new THREE.MeshStandardMaterial({ color: '#b9b2a8', roughness: 0.55 });

/** A simple figure shown while the mannequin loads, or if it can't. */
const StandIn: React.FC<{ pose: string }> = ({ pose }) => {
  const lying = pose === 'lying';
  return (
    <group rotation-z={lying ? -Math.PI / 2 : 0} position-y={lying ? 0.16 : 0}>
      <mesh position-y={1.0} material={SKIN} castShadow>
        <capsuleGeometry args={[0.17, 0.75, 6, 16]} />
      </mesh>
      <mesh position-y={1.6} material={SKIN} castShadow>
        <sphereGeometry args={[0.11, 20, 16]} />
      </mesh>
    </group>
  );
};
