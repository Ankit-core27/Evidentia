import type { SceneDefinition } from '../types/scene.js';
import { assetRegistry } from '../assets/asset-registry.js';

export const mockMurderScene: SceneDefinition = {
  schemaVersion: '1.0',
  sceneId: 'scene-murder-001',
  caseId: 'FOR-2026-001',
  title: 'Synthetic Residential Murder Scene',
  sceneType: 'indoor',
  units: 'meters',
  coordinateSystem: {
    up: 'Y',
    forward: '-Z',
    handedness: 'right',
    rotationOrder: 'XYZ',
  },
  environment: {
    type: 'residential_house',
    rooms: [
      {
        id: 'room-living-room',
        name: 'Living Room',
        type: 'living_room',
        dimensions: {
          width: 6.5,
          depth: 5.2,
          height: 3.2,
          area: 33.8,
        },
        structural: {
          floorTiles: [
            {
              id: 'floor-tile-01',
              assetId: 'floor_tile',
              label: 'Floor tile 01',
              transform: {
                position: [-2.5, 0, -2.2],
                rotation: [0, 0, 0],
                scale: [1, 1, 1],
              },
            },
            {
              id: 'floor-tile-02',
              assetId: 'floor_tile',
              label: 'Floor tile 02',
              transform: {
                position: [0, 0, -2.2],
                rotation: [0, 0, 0],
                scale: [1, 1, 1],
              },
            },
            {
              id: 'floor-tile-03',
              assetId: 'floor_tile',
              label: 'Floor tile 03',
              transform: {
                position: [2.5, 0, -2.2],
                rotation: [0, 0, 0],
                scale: [1, 1, 1],
              },
            },
          ],
          walls: [
            {
              id: 'wall-north',
              assetId: 'wall_section',
              label: 'North wall',
              transform: {
                position: [0, 1.6, -2.6],
                rotation: [0, 0, 0],
                scale: [6.5, 3.2, 0.25],
              },
            },
            {
              id: 'wall-west',
              assetId: 'wall_section',
              label: 'West wall',
              transform: {
                position: [-3.2, 1.6, 0],
                rotation: [0, 90, 0],
                scale: [5.2, 3.2, 0.25],
              },
            },
          ],
          doors: [
            {
              id: 'door-entry',
              assetId: 'door_wooden',
              label: 'Entry door',
              transform: {
                position: [3.2, 1.1, 0],
                rotation: [0, -90, 0],
                scale: [1, 1, 1],
              },
            },
          ],
          windows: [],
        },
      },
    ],
  },
  objects: [
    {
      id: 'table-main',
      name: 'Dining table',
      assetId: 'table_wooden',
      category: 'furniture',
      roomId: 'room-living-room',
      transform: {
        position: [0, 0.45, 0],
        rotation: [0, 0, 0],
        scale: [1.4, 1, 1.3],
      },
      provenance: {
        source: 'manual',
        confidence: 0.9,
        notes: 'Synthetic demonstration placement only.',
      },
    },
    {
      id: 'chair-left',
      name: 'Wooden chair',
      assetId: 'chair_wooden',
      category: 'furniture',
      roomId: 'room-living-room',
      transform: {
        position: [-1.8, 0, 0.8],
        rotation: [0, 30, 0],
        scale: [1, 1, 1],
      },
      provenance: {
        source: 'estimated',
        confidence: 0.7,
        notes: 'Approximate layout for demonstration.',
      },
    },
    {
      id: 'chair-right',
      name: 'Wooden chair',
      assetId: 'chair_wooden',
      category: 'furniture',
      roomId: 'room-living-room',
      transform: {
        position: [1.8, 0, 0.8],
        rotation: [0, -25, 0],
        scale: [1, 1, 1],
      },
      provenance: {
        source: 'estimated',
        confidence: 0.7,
        notes: 'Approximate layout for demonstration.',
      },
    },
    {
      id: 'body-victim',
      name: 'Victim body',
      assetId: 'victim_body',
      category: 'body',
      roomId: 'room-living-room',
      transform: {
        position: [0.4, 0.05, -0.2],
        rotation: [0, 18, 0],
        scale: [1, 1, 1],
      },
      provenance: {
        source: 'estimated',
        confidence: 0.65,
        notes: 'Synthetic demonstration pose only.',
      },
    },
    {
      id: 'knife-weapon',
      name: 'Knife',
      assetId: 'knife',
      category: 'weapon',
      roomId: 'room-living-room',
      transform: {
        position: [1.1, 0.82, -0.75],
        rotation: [60, 15, 78],
        scale: [1, 1, 1],
      },
      evidenceIds: ['evidence-knife-001'],
      provenance: {
        source: 'manual',
        confidence: 0.8,
      },
    },
    {
      id: 'door-structural',
      name: 'Door to hallway',
      assetId: 'door_wooden',
      category: 'structural',
      roomId: 'room-living-room',
      transform: {
        position: [3.0, 1.1, 0],
        rotation: [0, -90, 0],
        scale: [1, 1, 1],
      },
      provenance: {
        source: 'manual',
        confidence: 0.9,
      },
    },
  ],
  evidenceMarkers: [
    {
      id: 'marker-knife',
      label: 'Knife evidence marker',
      evidenceId: 'evidence-knife-001',
      objectId: 'knife-weapon',
      roomId: 'room-living-room',
      position: [1.05, 0.9, -0.62],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#f59e0b',
      metadata: {
        source: 'synthetic-demo',
      },
    },
    {
      id: 'marker-body',
      label: 'Body evidence marker',
      evidenceId: 'evidence-body-001',
      objectId: 'body-victim',
      roomId: 'room-living-room',
      position: [0.35, 0.52, -0.2],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#ef4444',
      metadata: {
        source: 'synthetic-demo',
      },
    },
  ],
  camera: {
    position: [8, 6, 8],
    target: [0, 0, 0],
    fov: 50,
    near: 0.1,
    far: 200,
  },
  metadata: {
    synthetic: true,
    purpose: 'phase-1-2-schema-demo',
    notes: 'This fixture is intentionally synthetic and not a forensic reconstruction.',
  },
};

export const mockMurderSceneAssetIds = Object.keys(assetRegistry);
