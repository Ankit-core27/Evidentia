import { useState } from 'react';
import {
  CrimeSceneEngine,
  mockMultiRoomScene,
  mockMurderScene,
  mockRoadAccidentScene,
  type SceneDefinition,
} from '@forensix/scene-engine';

const demoScenes: Record<string, SceneDefinition> = {
  murder: mockMurderScene,
  'multi-room': mockMultiRoomScene,
  road: mockRoadAccidentScene,
};

export function CrimeSceneDemo() {
  const [sceneId, setSceneId] = useState('murder');

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <label
        style={{
          position: 'absolute',
          zIndex: 3,
          top: 58,
          left: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: '#e2e8f0',
          background: '#0f172aee',
          border: '1px solid #475569',
          borderRadius: 6,
          padding: '5px 8px',
          font: '12px/1.2 sans-serif',
        }}
      >
        Demo scene
        <select
          aria-label="Demo scene"
          value={sceneId}
          onChange={(event) => setSceneId(event.target.value)}
          style={{ color: '#e2e8f0', background: '#0f172a', border: 0 }}
        >
          <option value="murder">Residential murder</option>
          <option value="multi-room">Multi-room house</option>
          <option value="road">Road collision</option>
        </select>
      </label>
      <CrimeSceneEngine
        scene={demoScenes[sceneId]}
        onObjectSelect={(object) => {
          console.info('Selected scene object:', object);
        }}
        style={{ minHeight: 0, height: '100%', borderRadius: 0 }}
      />
    </div>
  );
}
