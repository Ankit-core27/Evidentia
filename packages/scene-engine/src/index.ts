export * from './types/scene.js';
export * from './schema/scene.schema.js';
export * from './assets/asset-registry.js';
export * from './fixtures/mock-murder-scene.js';

import type { SceneDefinition } from './types/scene.js';

export interface CrimeSceneEngineProps {
  scene: SceneDefinition;
  onObjectSelect?: (objectId: string) => void;
}

export const CrimeSceneEngine = (_props: CrimeSceneEngineProps): null => {
  throw new Error(
    'CrimeSceneEngine is intentionally not implemented in this phase. Use the schema, validation API and asset registry to prepare scene data for the future renderer.',
  );
};
