import React from 'react';
import { Environment, Sky, Stars } from '@react-three/drei';
import { SCENE_ROOT } from './sceneFile';

// Daylight for a clear look at the scene, or night as at the time of the incident, lit by
// street lights and headlights. Night lighting is illustrative, not a lighting survey.

const SUN: [number, number, number] = [55, 48, 38];

export const Lighting: React.FC<{ night: boolean }> = ({ night }) =>
  night ? (
    <>
      <color attach="background" args={['#05070c']} />
      <fog attach="fog" args={['#06080e', 40, 170]} />
      <Environment files={`${SCENE_ROOT}/hdri/cobblestone_street_night_1k.hdr`} environmentIntensity={0.12} />
      <Stars radius={300} depth={40} count={1500} factor={3} saturation={0} fade />
      <hemisphereLight args={['#2c3956', '#0a0a0c', 0.2]} />
      <directionalLight
        position={[-40, 70, -30]}
        intensity={0.22}
        color="#a9bbff"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
    </>
  ) : (
    <>
      <Sky distance={4500} sunPosition={SUN} turbidity={7} rayleigh={1.3} mieCoefficient={0.006} mieDirectionalG={0.85} />
      <fog attach="fog" args={['#cfd8e0', 80, 300]} />
      <Environment files={`${SCENE_ROOT}/hdri/crosswalk_1k.hdr`} environmentIntensity={0.8} />
      <hemisphereLight args={['#dfe9f3', '#5d574e', 0.35]} />
      <directionalLight
        position={SUN}
        intensity={3.2}
        color="#fff2df"
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
        shadow-camera-far={220}
        shadow-bias={-0.0003}
        shadow-normalBias={0.035}
      />
    </>
  );
