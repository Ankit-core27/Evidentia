import type {
  AssetRegistry,
  RoomWall,
  SceneDefinition,
  SceneDiagnostic,
  SceneLoadDiagnostic,
  Vector3,
} from '@forensix/scene-engine';
import type { sceneSchema } from '@forensix/scene-engine';

export type PlannerEnvironment = 'indoor' | 'outdoor' | 'mixed';

export interface PlannerRoomConstraint {
  id?: string;
  name: string;
  type?: string;
  dimensions?: {
    width?: number;
    depth?: number;
    height?: number;
  };
  position?: Vector3;
  rotation?: Vector3;
}

export interface PlannerObjectConstraint {
  name: string;
  assetId?: string;
  roomName?: string;
  position?: Vector3;
  evidenceIds?: string[];
}

export interface PlannerEvidenceMarkerConstraint {
  evidenceId: string;
  label?: string;
  position: Vector3;
  roomName?: string;
  objectName?: string;
}

export interface PlannerConnectionConstraint {
  roomA: string;
  wallA: RoomWall;
  roomB: string;
  wallB: RoomWall;
  openingWidth?: number;
}

export interface PlannerRequest {
  description: string;
  environmentType: PlannerEnvironment;
  roomConstraints?: PlannerRoomConstraint[];
  objectConstraints?: PlannerObjectConstraint[];
  evidenceMarkerConstraints?: PlannerEvidenceMarkerConstraint[];
  permittedAssetIds?: string[];
  requestedLayout?: {
    connections?: PlannerConnectionConstraint[];
    entranceRoomId?: string;
    allowDisconnectedRooms?: boolean;
  };
  metadata?: Record<string, unknown>;
}

export interface ScenePlannerProviderRequest {
  plannerRequest: PlannerRequest;
  responseFormat: {
    name: 'forensix_scene_v1';
    schema: typeof sceneSchema;
  };
}

export interface ScenePlannerProvider {
  readonly id: string;
  readonly supportsStructuredOutput: boolean;
  generateScene(request: ScenePlannerProviderRequest): Promise<unknown>;
}

export type ScenePlannerDiagnosticCode =
  | SceneLoadDiagnostic['code']
  | SceneDiagnostic['code']
  | 'INVALID_PLANNER_REQUEST'
  | 'PROVIDER_ERROR'
  | 'MALFORMED_PROVIDER_OUTPUT'
  | 'UNRESOLVED_OBJECT_PLACEMENT'
  | 'UNSUPPORTED_ASSET_REQUEST';

export interface ScenePlannerDiagnostic {
  code: ScenePlannerDiagnosticCode;
  severity: 'error' | 'warning';
  path: string;
  message: string;
}

export type ScenePlannerResult =
  | {
      success: true;
      scene: SceneDefinition;
      providerId: string;
      diagnostics: ScenePlannerDiagnostic[];
    }
  | {
      success: false;
      providerId: string;
      diagnostics: ScenePlannerDiagnostic[];
    };

export interface ScenePlannerOptions {
  provider?: ScenePlannerProvider;
  registry?: AssetRegistry;
}
