import { create } from 'zustand';
import { Id } from '@/types/api';

// Shared between the reconstruction panel, the timeline and the 3D viewer (features/crime-scene).
interface StageState {
  reconstructionId: Id | null;
  stageId: Id | null;
  /** Scene object picked in the 3D viewer. */
  sceneObjectId: Id | null;
  setReconstruction: (reconstructionId: Id | null) => void;
  setStage: (stageId: Id | null) => void;
  selectSceneObject: (sceneObjectId: Id | null) => void;
}

export const useStageStore = create<StageState>()((set) => ({
  reconstructionId: null,
  stageId: null,
  sceneObjectId: null,
  setReconstruction: (reconstructionId) => set({ reconstructionId, stageId: null, sceneObjectId: null }),
  setStage: (stageId) => set({ stageId, sceneObjectId: null }),
  selectSceneObject: (sceneObjectId) => set({ sceneObjectId })
}));
