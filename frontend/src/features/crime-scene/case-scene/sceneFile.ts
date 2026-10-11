import { useQuery } from '@tanstack/react-query';
import { Vec3 } from '@/types/api';

// The authored layout of a scene, from assets/3d/crime-scenes/scenes/<scene_file>.
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
  corner_radius: number;
  kerb_height: number;
  /** Distance of each approach's stop line from the centre. */
  stop_line: number;
  /** Zebra crossings span this distance range from the centre on every arm. */
  crossing: [number, number];
}

export type StaticItem =
  | { kind: 'signal'; position: Vec3; heading: number; label?: string }
  | { kind: 'streetlight'; position: Vec3; heading: number }
  | { kind: 'tree'; position: Vec3; scale?: number }
  | {
      kind: 'building';
      position: Vec3;
      size: Vec3;
      heading: number;
      floors: number;
      colour: string;
      sign?: string;
      label?: string;
    }
  | { kind: 'skid-marks'; from: Vec3; to: Vec3; track: number; label?: string }
  | { kind: 'model'; model: string; position: Vec3; rotation?: Vec3; scale?: Vec3; label?: string };

export interface SceneFile {
  id: string;
  title: string;
  units: 'm';
  location?: { lat: number; lng: number };
  /** model_id to GLB URL, for scene objects and static models. */
  models: Record<string, string>;
  roads: RoadSpec[];
  junction?: JunctionSpec;
  static: StaticItem[];
  camera?: { position: Vec3; target: Vec3 };
}

export const SCENE_ROOT = '/3d/crime-scenes';

export const useSceneFile = (sceneFile: string | null) =>
  useQuery({
    queryKey: ['scene-file', sceneFile],
    enabled: !!sceneFile,
    staleTime: Infinity,
    queryFn: async ({ signal }) => {
      const res = await fetch(`${SCENE_ROOT}/scenes/${sceneFile}`, { signal });
      if (!res.ok) throw new Error(`Scene file ${sceneFile} could not be loaded (${res.status}).`);
      return (await res.json()) as SceneFile;
    }
  });

export const headingVector = (h: number): [number, number] => [Math.cos(h), -Math.sin(h)];

/** Height of the walking or driving surface at (x, z): carriageway 0, footpaths at kerb height. */
export function groundHeight(scene: SceneFile | undefined, x: number, z: number) {
  if (!scene) return 0;
  const kerb = scene.junction?.kerb_height ?? 0;
  for (const road of scene.roads) {
    const half = road.lanes_each_way * road.lane_width;
    const along = road.axis === 'x' ? x : z;
    const across = road.axis === 'x' ? z : x;
    if (along >= road.from && along <= road.to && Math.abs(across) <= half) return 0;
  }
  return kerb;
}
