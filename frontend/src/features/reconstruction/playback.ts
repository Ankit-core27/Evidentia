import { create } from 'zustand';
import { Id, ReconstructionDetail, SceneObject } from '@/types/api';

type ReconstructionStage = ReconstructionDetail['stages'][number];

// The time slider's playhead, shared by the reconstruction panel, the slider and the
// 3D viewer. Its position counts stages from 0: 1.5 is halfway between the second and
// third stage, and the viewer places each object between its two placements.
interface PlaybackState {
  position: number;
  playing: boolean;
  /** True while the slider is being dragged, so objects follow it without easing. */
  scrubbing: boolean;
  setPosition: (position: number) => void;
  setPlaying: (playing: boolean) => void;
  setScrubbing: (scrubbing: boolean) => void;
}

export const usePlaybackStore = create<PlaybackState>()((set) => ({
  position: 0,
  playing: false,
  scrubbing: false,
  setPosition: (position) => set({ position }),
  setPlaying: (playing) => set({ playing }),
  setScrubbing: (scrubbing) => set({ scrubbing })
}));

/** The two stages either side of a position and how far along it is between them. */
export function between(position: number, count: number): { from: number; to: number; progress: number } {
  if (count <= 1) return { from: 0, to: 0, progress: 0 };
  const clamped = Math.min(Math.max(position, 0), count - 1);
  const from = Math.min(Math.floor(clamped), count - 2);
  return { from, to: from + 1, progress: clamped - from };
}

/** A key that follows the same object from stage to stage. */
export const objectKey = (o: SceneObject) => (o.object_id != null ? `object:${o.object_id}` : `label:${o.label}`);

const shortestTurn = (from: number, to: number) => {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return from + d;
};

/** A scene object where the playhead puts it: x east, z south (metres), heading in radians. */
export interface PlacedObject {
  key: string;
  object: SceneObject;
  x: number;
  z: number;
  heading: number;
}

/**
 * The objects of the stage nearest the playhead, each placed between its placements in
 * the two stages either side of it. Outside a stage pair, objects sit at their own placement.
 */
export function placedAt(stages: ReconstructionStage[], stageId: Id | null, position: number): PlacedObject[] {
  const ordered = [...stages].sort((a, b) => a.stage_order - b.stage_order);
  const stage = ordered.find((s) => s.id === stageId);
  if (!stage) return [];
  const count = ordered.length;
  const near = Math.round(Math.min(Math.max(position, 0), count - 1));
  const { from, to, progress } = between(position, count);
  const tweening = count > 1 && ordered[near]?.id === stage.id && progress > 0.001 && progress < 0.999;
  const index = (s: ReconstructionStage) => new Map(s.scene_objects.map((o) => [objectKey(o), o]));
  const a = tweening ? index(ordered[from]) : null;
  const b = tweening ? index(ordered[to]) : null;
  return stage.scene_objects.map((o) => {
    const key = objectKey(o);
    const p = a?.get(key);
    const q = b?.get(key);
    if (!p || !q) return { key, object: o, x: o.position[0], z: o.position[2], heading: o.rotation[1] };
    const lerp = (u: number, v: number) => u + (v - u) * progress;
    return {
      key,
      object: o,
      x: lerp(p.position[0], q.position[0]),
      z: lerp(p.position[2], q.position[2]),
      heading: lerp(p.rotation[1], shortestTurn(p.rotation[1], q.rotation[1]))
    };
  });
}
