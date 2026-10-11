// Builds the inspectable building models and their manifest, and writes them to
// assets/3d/buildings/. Run from frontend/: npm run build:buildings
//
// Every component the building viewer can explode, hide or isolate is a named node whose
// glTF extras carry { kind, label, ... }:
//   building > roof | floor_<n> > slab_f<n> | wall_ext_<side>_f<n> | wall_int_f<n>_<id>
//                               | room_f<n>_<id> | stairs_f<n> | fur_f<n>_<id>
//   doors (door_f<n>_<id>) sit inside the wall that holds them.
// Walls carry `explode`, the unit direction they move in when the building is dissected.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { furniture } from './furniture.mjs';
import { box, component, slab, stairs, wall } from './geometry.mjs';
import { contextFootprints, cornerStore, officeBlock, pharmacy, teaStall } from './specs.mjs';

// GLTFExporter reads its binary output through FileReader, which Node lacks.
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    });
  }
};

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../assets/3d/buildings');

const SLAB = 0.2;
const EXT_T = 0.25;
const INT_T = 0.12;

const ROOM_FLOOR = {
  shop: 0x8a8f94, storage: 0x6e6a60, bath: 0x9fb4bc, corridor: 0x7b7f84, living: 0x9a7b5c,
  kitchen: 0xa9a59a, bedroom: 0x8c6d50, lobby: 0xb8b2a6, office: 0x5c6670, meeting: 0x55606b,
  security: 0x6b6f73, cafe: 0xa08a6a, server: 0x4e5257
};

function materials(colours) {
  const std = (name, color, opts = {}) => new THREE.MeshStandardMaterial({ name, color, roughness: 0.85, ...opts });
  const room = Object.fromEntries(Object.entries(ROOM_FLOOR).map(([k, c]) => [k, std(`floor_${k}`, c, { roughness: 0.7 })]));
  return {
    wall: std('wall_exterior', colours.wall),
    wallInt: std('wall_interior', colours.wallInt),
    concrete: std('concrete', 0x8c8c88),
    stair: std('stair', 0x9a9893),
    glass: std('glass', 0x7fb3c4, { roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35 }),
    door: std('door_timber', 0x6b4a2f, { roughness: 0.6 }),
    shutter: std('door_shutter', 0x7a7f84, { metalness: 0.6, roughness: 0.45 }),
    metal: std('metal', 0x6d7276, { metalness: 0.7, roughness: 0.4 }),
    wood: std('wood', 0x7a5636, { roughness: 0.6 }),
    fabric: std('fabric', 0x56606d),
    fabricDark: std('fabric_dark', 0x26292d),
    white: std('ceramic', 0xe8e8e4, { roughness: 0.35 }),
    stone: std('stone', 0xb9b5ab, { roughness: 0.4 }),
    goods: std('goods', 0xb2793a),
    cardboard: std('cardboard', 0xa47d4f),
    tank: std('tank', 0x1c1d1f, { roughness: 0.5 }),
    room
  };
}

const SIDE_DIR = { north: [0, 0, -1], south: [0, 0, 1], east: [1, 0, 0], west: [-1, 0, 0] };
const LEVEL_NAME = ['Ground floor', 'First floor', 'Second floor', 'Third floor'];

function roomBoxes(r) {
  return r.boxes ?? [r.box];
}

function buildFloor(spec, level, m, counts) {
  const f = spec.floors[level];
  const W = spec.width;
  const D = spec.depth;
  const H = spec.floorHeight;
  const base = level * H;
  const top = base + SLAB;
  const g = component(`floor_${level}`, { kind: 'floor', level, label: f.label, elevation_m: base });

  const below = level > 0 && spec.floors[level - 1].stairs;
  g.add(slab(`slab_f${level}`, { kind: 'slab', label: `${LEVEL_NAME[level]} slab`, level }, [-W / 2, -D / 2, W / 2, D / 2], base, top, m.concrete, below ? spec.hole : null));

  for (const r of f.rooms) {
    const boxes = roomBoxes(r);
    const area = boxes.reduce((a, [x0, z0, x1, z1]) => a + (x1 - x0) * (z1 - z0), 0);
    const meshes = boxes.map(([x0, z0, x1, z1], i) => box(`room_f${level}_${r.id}_${i}`, [x0, top, z0], [x1, top + 0.012, z1], m.room[r.type]));
    g.add(component(`room_f${level}_${r.id}`, { kind: 'room', label: r.label, room_type: r.type, level, area_m2: Math.round(area * 10) / 10 }, meshes));
    counts.rooms++;
  }

  const wallMats = { wall: m.wall, glass: m.glass, door: m.door, shutter: m.shutter };
  const intMats = { ...wallMats, wall: m.wallInt };
  const doorIds = (openings, prefix) => openings.map((o) => (o.id ? { ...o, id: `door_f${level}_${prefix}${o.id}` } : o));
  for (const [side, openings] of Object.entries(f.ext)) {
    const ns = side === 'north' || side === 'south';
    const sign = side === 'north' || side === 'west' ? -1 : 1;
    const geom = ns
      ? { axis: 'x', at: sign * (D / 2 - EXT_T / 2), from: -W / 2, to: W / 2 }
      : { axis: 'z', at: sign * (W / 2 - EXT_T / 2), from: -D / 2 + EXT_T, to: D / 2 - EXT_T };
    const os = doorIds(openings, '');
    counts.doors += os.filter((o) => o.id).length;
    g.add(wall(`wall_ext_${side}_f${level}`, { kind: 'wall', wall_type: 'exterior', side, level, label: `${side[0].toUpperCase()}${side.slice(1)} exterior wall`, explode: SIDE_DIR[side] }, { ...geom, y0: top, y1: base + H, t: EXT_T, openings: os }, wallMats));
    counts.walls++;
  }
  for (const w of f.int) {
    const os = doorIds(w.openings ?? [], '');
    counts.doors += os.filter((o) => o.id).length;
    g.add(wall(`wall_int_f${level}_${w.id}`, { kind: 'wall', wall_type: 'interior', level, label: w.label, explode: w.dir }, { axis: w.axis, at: w.at, from: w.from, to: w.to, y0: top, y1: base + H, t: INT_T, openings: os }, intMats));
    counts.walls++;
  }

  for (const item of f.furniture) {
    g.add(furniture({ ...item, id: `fur_f${level}_${item.id}`, room: `room_f${level}_${item.room}` }, top + 0.012, m));
    counts.furniture++;
  }

  if (f.stairs) {
    const nextTop = (level + 1) * H + SLAB;
    const s = stairs(`stairs_f${level}`, { kind: 'stairs', label: f.stairs.label, level, connects: [level, level + 1] }, f.stairs.box, top, nextTop, f.stairs.run, { stair: m.stair, metal: m.metal });
    g.add(s);
    counts.stairs++;
  }
  return g;
}

function buildRoof(spec, m) {
  const W = spec.width;
  const D = spec.depth;
  const y0 = spec.floors.length * spec.floorHeight;
  const y1 = y0 + SLAB;
  const p = spec.roof.parapet;
  const t = 0.2;
  const g = component('roof', { kind: 'roof', label: 'Roof slab and parapet', elevation_m: y0 });
  g.add(box('roof_slab', [-W / 2, y0, -D / 2], [W / 2, y1, D / 2], m.concrete));
  g.add(box('roof_parapet_n', [-W / 2, y1, -D / 2], [W / 2, y1 + p, -D / 2 + t], m.wall));
  g.add(box('roof_parapet_s', [-W / 2, y1, D / 2 - t], [W / 2, y1 + p, D / 2], m.wall));
  g.add(box('roof_parapet_w', [-W / 2, y1, -D / 2 + t], [-W / 2 + t, y1 + p, D / 2 - t], m.wall));
  g.add(box('roof_parapet_e', [W / 2 - t, y1, -D / 2 + t], [W / 2, y1 + p, D / 2 - t], m.wall));
  for (const fx of spec.roof.fixtures) g.add(furniture({ ...fx, id: `roof_${fx.id}`, room: null }, y1, m, 'fixture'));
  return g;
}

async function buildModel(spec) {
  const m = materials(spec.colours);
  const counts = { floors: spec.floors.length, rooms: 0, walls: 0, doors: 0, furniture: 0, stairs: 0 };
  const height = spec.floors.length * spec.floorHeight + SLAB + spec.roof.parapet;
  const root = component('building', { kind: 'building', building_id: spec.id, label: spec.name, floors: spec.floors.length, floor_height_m: spec.floorHeight, source: 'authored' });
  spec.floors.forEach((_, level) => root.add(buildFloor(spec, level, m, counts)));
  root.add(buildRoof(spec, m));

  const scene = new THREE.Scene();
  scene.add(root);
  const glb = await new GLTFExporter().parseAsync(scene, { binary: true });
  const file = `${spec.id}.glb`;
  fs.writeFileSync(path.join(OUT, file), Buffer.from(glb));
  console.log(`${file}: ${(glb.byteLength / 1024).toFixed(0)} KB`, counts);
  return {
    id: spec.id,
    name: spec.name,
    use: spec.use,
    geo_building_id: spec.geo_building_id,
    anchor: spec.anchor,
    footprint: { width_m: spec.width, depth_m: spec.depth },
    height_m: Math.round(height * 10) / 10,
    floors: spec.floors.map((f, level) => ({ level, label: f.label, elevation_m: level * spec.floorHeight })),
    model: { url: `/3d/buildings/${file}`, source: 'authored', components: counts },
    note: 'Authored illustrative model. The case records hold no survey or floor plan of this building.'
  };
}

fs.mkdirSync(OUT, { recursive: true });
const buildings = [await buildModel(cornerStore), await buildModel(officeBlock), await buildModel(teaStall), await buildModel(pharmacy)];
for (const c of contextFootprints) {
  buildings.push({
    id: c.id,
    name: c.name,
    use: c.use,
    geo_building_id: c.geo_building_id,
    anchor: c.anchor,
    footprint: { width_m: c.width, depth_m: c.depth },
    height_m: c.height,
    floors: Array.from({ length: c.floors }, (_, level) => ({ level, label: LEVEL_NAME[level] ?? `Floor ${level}`, elevation_m: (level * c.height) / c.floors })),
    model: null,
    note: 'Footprint and height are illustrative. No detailed model exists for this building.'
  });
}
const manifest = {
  version: 1,
  area: { name: 'Ring Road and 5th Avenue junction, Bengaluru; Sahyadri Chowk, Pune', frame: 'Model metres: origin at ground centre of footprint, +x east, -z north, +y up; heading_deg rotates the model clockwise from north.' },
  buildings
};
fs.writeFileSync(path.join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log('manifest.json written');
