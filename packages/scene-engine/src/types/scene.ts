export type Vector3 = [number, number, number];
export type Vector2 = [number, number];

export type SchemaVersion = '1.0';
export type SceneType = 'indoor' | 'outdoor' | 'road' | 'mixed';
export type EnvironmentType = string;
export type RotationOrder = 'XYZ' | 'YXZ' | 'ZXY' | 'ZYX' | 'XZY' | 'YZX';
export type ForwardAxis = '-Z' | 'Z' | '-X' | 'X' | '-Y' | 'Y';

export type ObjectCategory =
  | 'structural'
  | 'furniture'
  | 'body'
  | 'weapon'
  | 'vehicle'
  | 'evidence'
  | 'prop'
  | 'road'
  | 'lighting'
  | 'misc';

export interface AssetDimensionSpec {
  width?: number;
  height?: number;
  depth?: number;
  length?: number;
  radius?: number;
  unit?: 'meters';
}

export interface SceneTransform {
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
}

export interface AssetPlacement {
  id: string;
  assetId: string;
  label: string;
  transform: SceneTransform;
}

export interface StructuralLayout {
  floorTiles?: AssetPlacement[];
  walls?: AssetPlacement[];
  doors?: AssetPlacement[];
  windows?: AssetPlacement[];
}

export interface RoomDefinition {
  id: string;
  name: string;
  type: string;
  parentId?: string;
  dimensions?: {
    width?: number;
    depth?: number;
    height?: number;
    length?: number;
    area?: number;
  };
  structural?: StructuralLayout;
}

export interface SceneObjectDefinition {
  id: string;
  name: string;
  assetId: string;
  category: ObjectCategory | string;
  roomId?: string;
  parentId?: string;
  evidenceIds?: string[];
  transform: SceneTransform;
  provenance?: {
    source: 'manual' | 'estimated' | 'inferred' | 'unknown';
    confidence?: number;
    notes?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface EvidenceMarkerDefinition {
  id: string;
  label: string;
  evidenceId: string;
  objectId?: string;
  roomId?: string;
  position: Vector3;
  rotation?: Vector3;
  scale?: Vector3;
  color?: string;
  metadata?: Record<string, unknown>;
}

export interface CameraDefinition {
  position: Vector3;
  target: Vector3;
  fov?: number;
  near?: number;
  far?: number;
}

export interface CoordinateSystemDefinition {
  up: 'Y';
  forward: ForwardAxis;
  handedness: 'right' | 'left';
  rotationOrder: RotationOrder;
}

export interface SceneEnvironment {
  type: EnvironmentType;
  rooms: RoomDefinition[];
  metadata?: Record<string, unknown>;
}

export interface SceneDefinition {
  schemaVersion: SchemaVersion;
  sceneId: string;
  caseId: string;
  title: string;
  sceneType: SceneType;
  units: 'meters';
  coordinateSystem: CoordinateSystemDefinition;
  environment: SceneEnvironment;
  objects: SceneObjectDefinition[];
  evidenceMarkers: EvidenceMarkerDefinition[];
  camera?: CameraDefinition;
  metadata?: Record<string, unknown>;
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult {
  success: boolean;
  data?: SceneDefinition;
  errors: ValidationIssue[];
}
