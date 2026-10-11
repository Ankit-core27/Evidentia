import { useQuery } from '@tanstack/react-query';
import { ReconstructionDetail, Vec3 } from '@/types/api';

// The layout of a scene: the parts that don't change between stages. It is either an
// authored file in assets/3d/crime-scenes/scenes/<scene_file>, or generated from the
// case's evidence by the backend and stored on the reconstruction as `scene` (see
// backend/app/services/reconstruction/layout.py). Both have this shape.
// Metres; x east, y up, z south; origin at the scene's reference point. A heading h
// faces (cos h, 0, -sin h): 0 faces east and pi/2 faces north, as scene objects do.

export interface RoadSpec {
  name: string;
  /** The axis the road runs along. */
  axis: 'x' | 'z';
  from: number;
  to: number;
  lanes_each_way: number;
  lane_width: number;
}

export interface JunctionSpec {
  corner_radius?: number;
  kerb_height: number;
  /** Distance of each approach's stop line from the centre. */
  stop_line?: number;
  /** Zebra crossings span this distance range from the centre on every arm. */
  crossing?: [number, number];
  signals?: boolean;
}

/** Evidence behind a scene item, opened in the evidence inspector. */
export interface EvidenceRef {
  evidence_id: number;
  passage: string | null;
}

interface ItemBase {
  label?: string;
  /** Not in the evidence: placed to give the scene its context. */
  illustrative?: boolean;
  evidence?: EvidenceRef[];
}

export type TraceKind =
  | 'skid_marks'
  | 'debris'
  | 'glass'
  | 'blood'
  | 'impact_point'
  | 'fire_origin'
  | 'burn_area'
  | 'forced_entry'
  | 'footprints'
  | 'evidence_marker';

export type StaticItem = ItemBase &
  (
    | { kind: 'signal'; position: Vec3; heading: number }
    | { kind: 'streetlight'; position: Vec3; heading: number }
    | { kind: 'tree'; position: Vec3; scale?: number }
    | { kind: 'building'; position: Vec3; size: Vec3; heading: number; floors: number; colour: string; sign?: string }
    | { kind: 'skid-marks'; from: Vec3; to: Vec3; track: number }
    | { kind: 'bus-stop'; position: Vec3; heading: number }
    | { kind: 'wall'; from: Vec3; to: Vec3; height: number }
    | { kind: 'trace'; trace: TraceKind; position: Vec3; to?: Vec3; radius?: number }
    | { kind: 'model'; model: string; position: Vec3; rotation?: Vec3; scale?: Vec3; size?: Vec3 }
  );

/** A model in the catalogue (backend/app/services/reconstruction/catalogue.py). */
export interface ModelSpec {
  kind: 'vehicle' | 'person' | 'item' | 'furniture' | 'fixture';
  name: string;
  /** Length along the way it faces, width across, height (metres). */
  size: [number, number, number];
  url?: string;
  /** Drawn in code when there is no file, or the file fails. */
  shape?: string;
  /** "tile" repeats the file across its width; "stack" fills the size with copies. */
  fill?: 'tile' | 'stack';
  /** Height above the floor, for wall-mounted fittings. */
  elevation?: number;
  /** Has the paint and plate materials the viewer restyles. */
  restyle?: boolean;
}

export interface RoomOpening {
  kind: 'door' | 'window' | 'opening';
  wall: 'north' | 'south' | 'east' | 'west';
  /** Along the wall from its middle: +x on north and south walls, +z on east and west walls. */
  offset: number;
  width: number;
  height: number;
  sill: number;
  state: 'closed' | 'open' | 'forced' | 'broken';
  label: string;
}

export interface RoomSpec {
  id: string;
  name: string;
  x: number;
  z: number;
  /** Size along x and z. */
  width: number;
  depth: number;
  height: number;
  floor: 'wood' | 'tile' | 'marble' | 'concrete' | 'carpet';
  openings: RoomOpening[];
}

export interface GeneratedInfo {
  by: 'gemini' | 'rules';
  model: string;
  at: string;
  summary: string;
  open_questions: string[];
  warnings: string[];
}

export interface SceneFile {
  id: string;
  title: string;
  units: 'm';
  location?: { lat: number; lng: number };
  /** model_id to a GLB URL (authored files) or a catalogue entry (generated layouts). */
  models: Record<string, string | ModelSpec>;
  roads: RoadSpec[];
  junction?: JunctionSpec;
  rooms?: RoomSpec[];
  ground?: { kind: 'earth' | 'grass' | 'paving' | 'concrete' };
  static: StaticItem[];
  camera?: { position: Vec3; target: Vec3 };
  /** Where the action is, in (x, z): street lights nearest it are lit at night. */
  focus?: [number, number];
  setting?: { kind: 'road' | 'indoor' | 'outdoor'; description: string; address: string; time_of_day: string; drive_side: 'left' | 'right' };
  /** Colour and plate of entities without a case record, by label. */
  appearance?: Record<string, { colour?: string; plate?: string }>;
  generated?: GeneratedInfo;
  scenario?: { title: string; assumptions: string[]; supported_by: EvidenceRef[] };
  stages?: { stage_order: number; label: string; time: string; description: string }[];
}

export const SCENE_ROOT = '/3d/crime-scenes';

/** The model spec for a scene object's model_id ("person:lying" uses "person"). */
export function modelSpec(scene: SceneFile | undefined, modelId: string): ModelSpec | undefined {
  const entry = scene?.models[baseModel(modelId)];
  if (!entry) return undefined;
  return typeof entry === 'string' ? { kind: 'vehicle', name: modelId, size: [4, 1.8, 1.5], url: entry, restyle: true } : entry;
}

export const baseModel = (modelId: string) => modelId.split(':')[0];
export const modelVariant = (modelId: string) => modelId.split(':')[1] ?? '';

/** The reconstruction's layout: its generated scene, or its authored scene file. */
export function useSceneLayout(reconstruction: ReconstructionDetail) {
  const generated = (reconstruction.scene ?? null) as unknown as SceneFile | null;
  const file = useQuery({
    queryKey: ['scene-file', reconstruction.scene_file],
    enabled: !generated && !!reconstruction.scene_file,
    staleTime: Infinity,
    queryFn: async ({ signal }) => {
      const res = await fetch(`${SCENE_ROOT}/scenes/${reconstruction.scene_file}`, { signal });
      if (!res.ok) throw new Error(`Scene file ${reconstruction.scene_file} could not be loaded (${res.status}).`);
      return (await res.json()) as SceneFile;
    }
  });
  if (generated) return { scene: generated, ready: true, error: null as string | null };
  return {
    scene: file.data,
    ready: !reconstruction.scene_file || file.isSuccess || file.isError,
    error: file.isError ? (file.error as Error).message : null
  };
}

export const headingVector = (h: number): [number, number] => [Math.cos(h), -Math.sin(h)];

/** Height of the walking or driving surface at (x, z): carriageway 0, footpaths at kerb height. */
export function groundHeight(scene: SceneFile | undefined, x: number, z: number) {
  if (!scene || !scene.roads.length) return 0;
  const kerb = scene.junction?.kerb_height ?? 0;
  for (const road of scene.roads) {
    const half = road.lanes_each_way * road.lane_width;
    const along = road.axis === 'x' ? x : z;
    const across = road.axis === 'x' ? z : x;
    if (along >= road.from - 0.01 && along <= road.to + 0.01 && Math.abs(across) <= half) return 0;
  }
  return kerb;
}
