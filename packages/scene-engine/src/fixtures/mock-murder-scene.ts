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
        position: [0, 0, 0],
        dimensions: {
          width: 6.5,
          depth: 5.2,
          height: 3.2,
          area: 33.8,
        },
        structural: {
          floorTiles: Array.from({ length: 6 }, (_, index) => ({
            id: `floor-tile-${String(index + 1).padStart(2, '0')}`,
            assetId: 'floor_tile',
            label: `Floor tile ${index + 1}`,
            transform: {
              position: [-2.167 + (index % 3) * 2.167, 0, index < 3 ? -1.3 : 1.3] as [number, number, number],
              rotation: [0, 0, 0] as [number, number, number],
              scale: [0.722, 1, 0.867] as [number, number, number],
            },
          })),
          walls: [
            {
              id: 'wall-north',
              assetId: 'wall_section',
              label: 'North wall',
              transform: {
                position: [0, 0, -2.6],
                rotation: [0, 0, 0],
                scale: [2.167, 1.28, 1.667],
              },
            },
            {
              id: 'wall-south',
              assetId: 'wall_section',
              label: 'South wall',
              transform: {
                position: [0, 0, 2.6],
                rotation: [0, 180, 0],
                scale: [2.167, 1.28, 1.667],
              },
            },
            {
              id: 'wall-west',
              assetId: 'wall_section',
              label: 'West wall',
              transform: {
                position: [-3.25, 0, 0],
                rotation: [0, 90, 0],
                scale: [1.733, 1.28, 1.667],
              },
            },
            {
              id: 'wall-east-north',
              assetId: 'wall_section',
              label: 'East wall, north section',
              transform: {
                position: [3.25, 0, -1.55],
                rotation: [0, 90, 0],
                scale: [0.7, 1.28, 1.667],
              },
            },
            {
              id: 'wall-east-south',
              assetId: 'wall_section',
              label: 'East wall, south section',
              transform: {
                position: [3.25, 0, 1.55],
                rotation: [0, 90, 0],
                scale: [0.7, 1.28, 1.667],
              },
            },
          ],
          doors: [
            {
              id: 'door-entry',
              assetId: 'door_wooden',
              label: 'Entry door',
              transform: {
                position: [3.25, 0, 0],
                rotation: [0, 90, 0],
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
        position: [0, 0, 0],
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
        position: [-1.25, 0.05, -1.2],
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
        position: [1.1, 0.025, -0.75],
        rotation: [0, 15, 78],
        scale: [1, 1, 1],
      },
      evidenceIds: ['evidence-knife-001'],
      provenance: {
        source: 'manual',
        confidence: 0.8,
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
      position: [1.05, 0.05, -0.62],
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
      position: [-1.55, 0.25, -1.2],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#ef4444',
      metadata: {
        source: 'synthetic-demo',
      },
    },
  ],
  camera: {
    position: [8, 12, 8],
    target: [0, 0, 0],
    fov: 50,
    near: 0.1,
    far: 200,
  },
  metadata: {
    synthetic: true,
    purpose: 'phase-1-2-schema-demo',
    notes: 'This fixture is intentionally synthetic and not a forensic reconstruction. GLB bounds were read from the included model metadata; model origins remain asset-local and are not normalized at load time.',
  },
};

export const mockMurderSceneAssetIds = Object.keys(assetRegistry);
