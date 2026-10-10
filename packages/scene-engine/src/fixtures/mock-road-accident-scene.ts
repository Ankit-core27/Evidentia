import type { SceneDefinition } from '../types/scene.js';

export const mockRoadAccidentScene: SceneDefinition = {
  schemaVersion: '1.0',
  sceneId: 'scene-road-accident-demo',
  caseId: 'FOR-DEMO-ROAD',
  title: 'Synthetic Road Collision Scene',
  sceneType: 'road',
  units: 'meters',
  coordinateSystem: {
    up: 'Y',
    forward: '-Z',
    handedness: 'right',
    rotationOrder: 'XYZ',
  },
  environment: {
    type: 'urban_road',
    rooms: [],
    metadata: { outdoor: true },
  },
  objects: [
    {
      id: 'road-segment',
      name: 'Road segment',
      assetId: 'road_straight',
      category: 'road',
      transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      metadata: { surface: 'synthetic asphalt' },
    },
    {
      id: 'vehicle-sedan',
      name: 'Sedan',
      assetId: 'sedan_car',
      category: 'vehicle',
      transform: { position: [-1.2, 0, 0.3], rotation: [0, -12, 0], scale: [1, 1, 1] },
      evidenceIds: ['evidence-road-debris'],
    },
    {
      id: 'vehicle-motorcycle',
      name: 'Motorcycle',
      assetId: 'motorcycle',
      category: 'vehicle',
      transform: { position: [1.5, 0, -0.8], rotation: [0, 38, 0], scale: [1, 1, 1] },
    },
    {
      id: 'road-debris',
      name: 'Debris fragment',
      assetId: 'debris_fragment',
      category: 'prop',
      transform: { position: [0.3, 0.02, 0.6], rotation: [0, 25, 0], scale: [1, 1, 1] },
      evidenceIds: ['evidence-road-debris'],
    },
    {
      id: 'traffic-cone',
      name: 'Traffic cone',
      assetId: 'traffic_cone',
      category: 'road',
      transform: { position: [3, 0, 1.5], rotation: [0, 0, 0], scale: [1, 1, 1] },
    },
  ],
  evidenceMarkers: [
    {
      id: 'marker-road-debris',
      label: 'Debris evidence marker',
      evidenceId: 'evidence-road-debris',
      objectId: 'road-debris',
      position: [0.3, 0.2, 0.6],
      color: '#f59e0b',
      metadata: { source: 'synthetic-demo' },
    },
  ],
  camera: {
    position: [8, 7, 10],
    target: [0, 0.4, 0],
    fov: 50,
    near: 0.1,
    far: 300,
  },
  metadata: {
    synthetic: true,
    purpose: 'road-scene-renderer-demo',
    notes: 'Synthetic road layout used to exercise the renderer with an outdoor scene definition.',
  },
};
