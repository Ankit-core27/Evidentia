// The contract between the frontend track and the 3D track (docs/PLAN.md: features/crime-scene).
//
// The Reconstruction module renders a scene viewer with these props: the 3D viewer
// (features/crime-scene/case-scene/CaseSceneViewer) or the top-down 2D plan
// (SchematicSceneView). Viewers save annotations with useCreateAnnotation and placements
// with useSaveSceneObjects (hooks/useReconstruction.ts).
import { Id, ReconstructionDetail } from '@/types/api';

export interface SceneViewerProps {
  reconstruction: ReconstructionDetail;
  /** Stage to show; its scene_objects give each object's position, rotation (radians) and scale, in metres. */
  stageId: Id;
  selectedSceneObjectId: Id | null;
  /** Called when an object is clicked, or with null when empty space is clicked. */
  onSelectSceneObject: (sceneObjectId: Id | null) => void;
}
