// The contract between the frontend track and the 3D track (docs/PLAN.md: features/crime-scene).
//
// The Reconstruction module renders a scene viewer with these props. Until the 3D track's
// React Three Fiber viewer lands, SchematicSceneView (a top-down 2D plot) stands in for it.
// To plug the 3D viewer in, export a component with this signature from features/crime-scene
// and swap it into SceneHost. It can save placements and annotations with useSaveSceneObjects,
// useAnnotations and useCreateAnnotation (hooks/useReconstruction.ts).
import { Id, ReconstructionDetail } from '@/types/api';

export interface SceneViewerProps {
  reconstruction: ReconstructionDetail;
  /** Stage to show; its scene_objects give each object's position, rotation (radians) and scale, in metres. */
  stageId: Id;
  selectedSceneObjectId: Id | null;
  /** Called when an object is clicked, or with null when empty space is clicked. */
  onSelectSceneObject: (sceneObjectId: Id | null) => void;
}
