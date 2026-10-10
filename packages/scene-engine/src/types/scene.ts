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
  unit?: 'meters' | 'source-units';
}

export type AssetCalibrationStatus =
  | 'source-bounds-inspected'
  | 'demo-scale-estimate'
  | 'physical-dimensions-verified'
  | 'not-inspected';

export interface AssetCalibration {
  status: AssetCalibrationStatus;
  sourceUnits: 'unknown' | 'meters' | 'centimeters' | 'millimeters' | 'inches' | 'feet';
  sourceDimensions?: Vector3;
  sourceBounds?: {
    min: Vector3;
    max: Vector3;
  };
  physicalDimensions?: AssetDimensionSpec;
  originConvention?: 'center' | 'bottom' | 'front-left' | 'custom' | 'unknown';
  defaultScale?: Vector3;
  rotationCorrection?: Vector3;
  positionCorrection?: Vector3;
  notes?: string;
}

export interface SceneTransform {
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
}

export interface SceneSelectionTransform extends SceneTransform {
  space: 'world';
  positionUnit: 'meters';
  rotationUnit: 'degrees';
  scaleUnit: 'unitless';
}

export interface SceneSelectionAssociation {
  sceneType: SceneType;
  environmentType: EnvironmentType;
  roomId?: string;
  roomName?: string;
}

interface SceneSelectionBase {
  id: string;
  name: string;
  assetId: string;
  category: ObjectCategory | string;
  association: SceneSelectionAssociation;
  transform: SceneSelectionTransform;
  evidenceIds: string[];
  evidenceRecordAvailability: 'not-included-in-scene-schema';
  provenance?: SceneObjectDefinition['provenance'];
  calibration: AssetCalibration;
  metadata?: Record<string, unknown>;
}

export interface SceneObjectSelection extends SceneSelectionBase {
  kind: 'object';
}

export interface EvidenceMarkerSelection extends SceneSelectionBase {
  kind: 'evidence-marker';
  evidenceId: string;
  objectId?: string;
}

export type SceneSelection = SceneObjectSelection | EvidenceMarkerSelection;

export interface SceneAssetLoadError {
  id: string;
  name: string;
  assetId: string;
  url: string;
  message: string;
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
  position?: Vector3;
  rotation?: Vector3;
  layoutMode?: 'authored' | 'procedural';
  wallThickness?: number;
  floor?: {
    enabled?: boolean;
  };
  ceiling?: {
    enabled?: boolean;
  };
  openings?: RoomOpening[];
  dimensions?: {
    width?: number;
    depth?: number;
    height?: number;
    length?: number;
    area?: number;
  };
  structural?: StructuralLayout;
}

export type RoomWall = 'north' | 'south' | 'east' | 'west';

export interface RoomOpening {
  id: string;
  type: 'door' | 'window';
  wall: RoomWall;
  /** Distance from the start edge along the room-local wall axis, in metres. */
  offset: number;
  width: number;
  height: number;
  sillHeight: number;
  assetId?: string;
  label?: string;
}

export interface SharedBoundary {
  id: string;
  roomA: string;
  wallA: RoomWall;
  roomB: string;
  wallB: RoomWall;
  openingId?: string;
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
  sharedBoundaries?: SharedBoundary[];
  entranceRoomId?: string;
  allowDisconnectedRooms?: boolean;
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

export type DiagnosticSeverity = 'error' | 'warning';

export interface SceneDiagnostic extends ValidationIssue {
  severity: DiagnosticSeverity;
  code: string;
}
