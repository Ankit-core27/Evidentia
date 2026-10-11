import { create } from 'zustand';

/** A Cesium camera pose, stored as plain numbers so it survives the viewer being rebuilt. */
export interface CameraPose {
  position: [number, number, number];
  heading: number;
  pitch: number;
  roll: number;
}

/** A building picked in the area view: an authored manifest entry or a streamed OSM feature. */
export type AreaSelection =
  | { source: 'manifest'; id: string }
  | { source: 'osm'; id: string; name: string; properties: Record<string, string> };

interface AreaState {
  /** The case the view and selection belong to; opening another case resets them. */
  caseId: number | null;
  /** Which scene is in front: the Cesium area overview or the dissection of one building. */
  view: 'area' | 'building';
  selection: AreaSelection | null;
  radiusM: number;
  /** Camera saved per case when a building is opened, so returning lands on the same view. */
  cameras: Record<number, CameraPose>;
  bindCase: (caseId: number) => void;
  select: (selection: AreaSelection | null) => void;
  setRadius: (radiusM: number) => void;
  openBuilding: (caseId: number, camera: CameraPose | null) => void;
  returnToArea: () => void;
  saveCamera: (caseId: number, camera: CameraPose) => void;
}

export const useAreaStore = create<AreaState>()((set) => ({
  caseId: null,
  view: 'area',
  selection: null,
  radiusM: 150,
  cameras: {},
  bindCase: (caseId) => set((s) => (s.caseId === caseId ? s : { caseId, view: 'area', selection: null })),
  select: (selection) => set({ selection }),
  setRadius: (radiusM) => set({ radiusM }),
  openBuilding: (caseId, camera) =>
    set((s) => ({ view: 'building', cameras: camera ? { ...s.cameras, [caseId]: camera } : s.cameras })),
  returnToArea: () => set({ view: 'area' }),
  saveCamera: (caseId, camera) => set((s) => ({ cameras: { ...s.cameras, [caseId]: camera } }))
}));
