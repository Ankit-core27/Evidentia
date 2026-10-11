import type { CameraControls as CameraControlsImpl } from '@react-three/drei';
import { create } from 'zustand';
import { Vec3 } from '@/types/api';

export type ViewerTool = 'none' | 'measure' | 'note' | 'view';
export type TimeOfDay = 'day' | 'night';

/** A point picked in the scene while a tool is active. */
export interface PickedPoint {
  point: Vec3;
}

interface ViewerState {
  controls: CameraControlsImpl | null;
  tool: ViewerTool;
  /** Points placed by the active tool so far, and the point under the pointer. */
  picks: Vec3[];
  hover: Vec3 | null;
  showLabels: boolean;
  showPaths: boolean;
  timeOfDay: TimeOfDay;
  /** Camera heading in radians, for the compass. */
  azimuth: number;
  setControls: (controls: CameraControlsImpl | null) => void;
  setTool: (tool: ViewerTool) => void;
  addPick: (p: Vec3) => void;
  setHover: (p: Vec3 | null) => void;
  resetPicks: () => void;
  toggleLabels: () => void;
  togglePaths: () => void;
  setTimeOfDay: (t: TimeOfDay) => void;
  setAzimuth: (a: number) => void;
}

export const useViewerStore = create<ViewerState>()((set) => ({
  controls: null,
  tool: 'none',
  picks: [],
  hover: null,
  showLabels: true,
  showPaths: true,
  timeOfDay: 'day',
  azimuth: 0,
  setControls: (controls) => set({ controls }),
  setTool: (tool) => set({ tool, picks: [], hover: null }),
  addPick: (p) => set((s) => ({ picks: [...s.picks, p] })),
  setHover: (hover) => set({ hover }),
  resetPicks: () => set({ picks: [], hover: null }),
  toggleLabels: () => set((s) => ({ showLabels: !s.showLabels })),
  togglePaths: () => set((s) => ({ showPaths: !s.showPaths })),
  setTimeOfDay: (timeOfDay) => set({ timeOfDay }),
  setAzimuth: (azimuth) => set({ azimuth })
}));

/** Smoothly moves the camera to look from position at target. */
export function flyTo(controls: CameraControlsImpl | null, position: Vec3, target: Vec3) {
  if (!controls) return;
  const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  void controls.setLookAt(position[0], position[1], position[2], target[0], target[1], target[2], smooth);
}
