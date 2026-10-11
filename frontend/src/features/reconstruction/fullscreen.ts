import { createContext, useContext } from 'react';

/**
 * Full screen for the whole stage workspace (stage bar, scene, time slider and side
 * panels), not just the 3D canvas, so selections and evidence stay in view. The
 * reconstruction panel provides it; the viewer's full-screen button uses it.
 */
export interface SceneFullscreen {
  active: boolean;
  toggle: () => void;
}

export const SceneFullscreenContext = createContext<SceneFullscreen | null>(null);

export const useSceneFullscreen = () => useContext(SceneFullscreenContext);
