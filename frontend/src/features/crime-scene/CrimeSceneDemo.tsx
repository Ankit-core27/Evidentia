import {
  CrimeSceneEngine,
  mockMurderScene,
} from '@forensix/scene-engine';

export function CrimeSceneDemo() {
  return (
    <CrimeSceneEngine
      scene={mockMurderScene}
      onObjectSelect={(object) => {
        console.info('Selected scene object:', object);
      }}
      style={{ minHeight: 0, height: '100%', borderRadius: 0 }}
    />
  );
}
