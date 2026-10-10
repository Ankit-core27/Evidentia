import type { AssetDimensionSpec } from '../types/scene.js';

export interface AssetRegistryEntry {
  id: string;
  name: string;
  category: string;
  url: string;
  format: 'glb' | 'gltf' | 'obj' | 'fbx';
  dimensions?: AssetDimensionSpec;
  origin?: {
    x?: number;
    y?: number;
    z?: number;
    pivot?: 'center' | 'bottom' | 'front-left' | 'custom';
  };
  defaultScale?: number;
  tags?: string[];
}

export type AssetRegistry = Record<string, AssetRegistryEntry>;

export const assetRegistry: AssetRegistry = {
  bed_single: {
    id: 'bed_single',
    name: 'Single Bed',
    category: 'furniture',
    url: '/crime-scenes/library/bed_single.glb',
    format: 'glb',
    tags: ['bed', 'indoor', 'furniture'],
  },
  bottle: {
    id: 'bottle',
    name: 'Bottle',
    category: 'prop',
    url: '/crime-scenes/library/bottle.glb',
    format: 'glb',
    tags: ['prop', 'indoor'],
  },
  chair_wooden: {
    id: 'chair_wooden',
    name: 'Wooden Chair',
    category: 'furniture',
    url: '/crime-scenes/library/chair_wooden.glb',
    format: 'glb',
    tags: ['chair', 'wood', 'indoor'],
  },
  cupboard_wooden: {
    id: 'cupboard_wooden',
    name: 'Wooden Cupboard',
    category: 'furniture',
    url: '/crime-scenes/library/cupboard_wooden.glb',
    format: 'glb',
    tags: ['cabinet', 'wood', 'indoor'],
  },
  debris_fragment: {
    id: 'debris_fragment',
    name: 'Debris Fragment',
    category: 'prop',
    url: '/crime-scenes/library/debris_fragment.glb',
    format: 'glb',
    tags: ['debris', 'indoor', 'outdoor'],
  },
  document: {
    id: 'document',
    name: 'Document',
    category: 'evidence',
    url: '/crime-scenes/library/document.glb',
    format: 'glb',
    tags: ['document', 'evidence'],
  },
  door_wooden: {
    id: 'door_wooden',
    name: 'Wooden Door',
    category: 'structural',
    url: '/crime-scenes/library/door_wooden.glb',
    format: 'glb',
    tags: ['door', 'wood', 'structural', 'indoor'],
  },
  evidence_marker: {
    id: 'evidence_marker',
    name: 'Evidence Marker',
    category: 'evidence',
    url: '/crime-scenes/library/evidence_marker.glb',
    format: 'glb',
    tags: ['marker', 'evidence'],
  },
  floor_tile: {
    id: 'floor_tile',
    name: 'Floor Tile',
    category: 'structural',
    url: '/crime-scenes/library/floor_tile.glb',
    format: 'glb',
    tags: ['floor', 'tile', 'structural', 'indoor'],
  },
  knife: {
    id: 'knife',
    name: 'Knife',
    category: 'weapon',
    url: '/crime-scenes/library/knife.glb',
    format: 'glb',
    tags: ['weapon', 'knife'],
  },
  motorcycle: {
    id: 'motorcycle',
    name: 'Motorcycle',
    category: 'vehicle',
    url: '/crime-scenes/library/motorcycle.glb',
    format: 'glb',
    tags: ['vehicle', 'road', 'outdoor'],
  },
  road_sign: {
    id: 'road_sign',
    name: 'Road Sign',
    category: 'road',
    url: '/crime-scenes/library/road_sign.glb',
    format: 'glb',
    tags: ['road', 'sign', 'outdoor'],
  },
  road_straight: {
    id: 'road_straight',
    name: 'Straight Road Segment',
    category: 'road',
    url: '/crime-scenes/library/road_straight.glb',
    format: 'glb',
    tags: ['road', 'outdoor'],
  },
  roadside_curb: {
    id: 'roadside_curb',
    name: 'Roadside Curb',
    category: 'road',
    url: '/crime-scenes/library/roadside_curb.glb',
    format: 'glb',
    tags: ['road', 'curb', 'outdoor'],
  },
  sedan_car: {
    id: 'sedan_car',
    name: 'Sedan Car',
    category: 'vehicle',
    url: '/crime-scenes/library/sedan_car.glb',
    format: 'glb',
    tags: ['vehicle', 'road', 'outdoor'],
  },
  smartphone: {
    id: 'smartphone',
    name: 'Smartphone',
    category: 'prop',
    url: '/crime-scenes/library/smartphone.glb',
    format: 'glb',
    tags: ['phone', 'prop', 'evidence'],
  },
  streetlight: {
    id: 'streetlight',
    name: 'Streetlight',
    category: 'lighting',
    url: '/crime-scenes/library/streetlight.glb',
    format: 'glb',
    tags: ['streetlight', 'lighting', 'outdoor'],
  },
  table_wooden: {
    id: 'table_wooden',
    name: 'Wooden Table',
    category: 'furniture',
    url: '/crime-scenes/library/table_wooden.glb',
    format: 'glb',
    tags: ['table', 'furniture', 'wood', 'indoor'],
  },
  tire_skid_mark: {
    id: 'tire_skid_mark',
    name: 'Tire Skid Mark',
    category: 'road',
    url: '/crime-scenes/library/tire_skid_mark.glb',
    format: 'glb',
    tags: ['road', 'skid', 'marks'],
  },
  traffic_cone: {
    id: 'traffic_cone',
    name: 'Traffic Cone',
    category: 'road',
    url: '/crime-scenes/library/traffic_cone.glb',
    format: 'glb',
    tags: ['road', 'cone', 'outdoor'],
  },
  victim_body: {
    id: 'victim_body',
    name: 'Victim Body',
    category: 'body',
    url: '/crime-scenes/library/victim_body.glb',
    format: 'glb',
    tags: ['body', 'victim', 'indoor'],
  },
  wall_section: {
    id: 'wall_section',
    name: 'Wall Section',
    category: 'structural',
    url: '/crime-scenes/library/wall_section.glb',
    format: 'glb',
    tags: ['wall', 'structural', 'indoor'],
  },
};

export const assetRegistryList = Object.values(assetRegistry);

export function getAssetRegistryEntry(assetId: string): AssetRegistryEntry | undefined {
  return assetRegistry[assetId];
}

export function isKnownAssetId(assetId: string): boolean {
  return assetId in assetRegistry;
}
