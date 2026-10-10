import { useCallback, useState } from 'react';
import {
  CrimeSceneEngine,
  mockMultiRoomScene,
  mockMurderScene,
  mockRoadAccidentScene,
  type SceneDefinition,
  type SceneSelection,
} from '@forensix/scene-engine';
import { SceneInspectionPanel } from '@/features/crime-scene/SceneInspectionPanel';

const demoScenes: Record<string, SceneDefinition> = {
  murder: mockMurderScene,
  'multi-room': mockMultiRoomScene,
  road: mockRoadAccidentScene,
};

interface CrimeSceneDemoProps {
  onEvidenceNavigate?: (evidenceId: string) => void;
}

export function CrimeSceneDemo({ onEvidenceNavigate }: CrimeSceneDemoProps) {
  const [sceneId, setSceneId] = useState('murder');
  const [selection, setSelection] = useState<SceneSelection | null>(null);
  const handleSelectionChange = useCallback((nextSelection: SceneSelection | null) => {
    setSelection(nextSelection);
  }, []);
  const handleEvidenceNavigate = useCallback((evidenceId: string) => {
    if (onEvidenceNavigate) {
      onEvidenceNavigate(evidenceId);
    } else {
      console.info('Evidence navigation requested for scene reference:', evidenceId);
    }
  }, [onEvidenceNavigate]);

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_15rem]" data-testid="crime-scene-demo">
      <div className="relative min-h-0">
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
        onSelectionChange={handleSelectionChange}
        onObjectSelect={(object) => {
          console.info('Selected scene object:', object);
        }}
        style={{ minHeight: 0, height: '100%', borderRadius: 0 }}
      />
      </div>
      <SceneInspectionPanel
        selection={selection}
        onEvidenceSelect={handleEvidenceNavigate}
      />
    </div>
  );
}
