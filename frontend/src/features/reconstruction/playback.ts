import { create } from 'zustand';

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
