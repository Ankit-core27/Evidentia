import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { Group } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { CaseWorkspace } from '@/types/api';
import { BuildingEntry, footprintCorners, distanceMetres } from '@/features/geographic-area/buildingRegistry';
import { COMPONENT_KINDS, ComponentKind, analyse, applyExplosion, applyVisibility, ownerPart } from './dissection';
import { buildingMarkers } from './buildingMarkers';

const ASSETS = new URL('../../../../assets/3d/buildings/', import.meta.url);

function load(file: string): Promise<Group> {
  const buf = readFileSync(new URL(file, ASSETS));
  const data = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((resolve, reject) => new GLTFLoader().parse(data, '', (g) => resolve(g.scene), reject));
}

const allKinds = Object.fromEntries(COMPONENT_KINDS.map((k) => [k.kind, true])) as Record<ComponentKind, boolean>;
const manifest = JSON.parse(readFileSync(new URL('manifest.json', ASSETS), 'utf8')) as { buildings: BuildingEntry[] };

for (const entry of manifest.buildings.filter((b) => b.model)) {
  const file = entry.model!.url.split('/').pop()!;

  test(`${entry.id}: model has separable roof, floors, walls and interiors`, async () => {
    const d = analyse(await load(file));
    const count = (k: string) => d.parts.filter((p) => p.kind === k).length;
    assert.equal(count('roof'), 1);
    assert.equal(d.floors.length, entry.floors.length);
    for (const [kind, n] of Object.entries(entry.model!.components)) {
      if (kind !== 'floors') assert.equal(count(kind === 'walls' ? 'wall' : kind === 'rooms' ? 'room' : kind === 'doors' ? 'door' : kind), n, kind);
    }
    assert.ok(d.parts.filter((p) => p.kind === 'wall').every((p) => p.dir.lengthSq() > 0.99), 'every wall has an explode direction');
  });

  test(`${entry.id}: explosion separates parts and t = 0 restores every transform exactly`, async () => {
    const scene = await load(file);
    const d = analyse(scene);
    const original = new Map(d.parts.map((p) => [p, p.object.position.clone()]));
    applyExplosion(d, 1);
    const roof = d.parts.find((p) => p.kind === 'roof')!;
    assert.ok(roof.object.position.y - original.get(roof)!.y > d.floorHeight, 'roof lifted clear');
    const top = d.floors[d.floors.length - 1];
    assert.ok(top.part.object.position.y > original.get(top.part)!.y, 'upper floor raised');
    assert.equal(d.floors[0].part.object.position.y, original.get(d.floors[0].part)!.y, 'ground floor stays');
    const wall = d.parts.find((p) => p.wallType === 'exterior')!;
    const moved = wall.object.position.clone().sub(original.get(wall)!);
    assert.ok(moved.dot(wall.dir) > 2, 'exterior wall moved outward');
    applyExplosion(d, 0.37);
    applyExplosion(d, 0);
    for (const [p, pos] of original) assert.ok(p.object.position.equals(pos), `${p.name} restored`);
  });

  test(`${entry.id}: floor filter and isolation hide everything else`, async () => {
    const d = analyse(await load(file));
    applyVisibility(d, { level: 0, kinds: allKinds, hidden: new Set(), isolated: null });
    for (const mesh of d.materials.keys()) {
      const owner = ownerPart(d, mesh);
      if (owner?.kind === 'roof' || (owner?.level ?? 0) !== 0) assert.equal(mesh.visible, false, mesh.name);
    }
    const room = d.parts.find((p) => p.kind === 'room')!;
    applyVisibility(d, { level: 'all', kinds: allKinds, hidden: new Set(), isolated: room.name });
    const shown = [...d.materials.keys()].filter((m) => m.visible);
    assert.ok(shown.length > 0 && shown.every((m) => ownerPart(d, m) === room));
  });
}

test('footprints follow the anchor and heading', () => {
  const b = manifest.buildings[0];
  const corners = footprintCorners(b);
  const diag = Math.hypot(b.footprint.width_m, b.footprint.depth_m) / 2;
  for (const c of corners) assert.ok(Math.abs(distanceMetres(b.anchor, c) - diag) < 0.05);
  const [nw] = footprintCorners({ ...b, anchor: { ...b.anchor, heading_deg: 0 } });
  assert.ok(nw.lat > b.anchor.lat && nw.lng < b.anchor.lng, 'first corner is north-west');
  const [turned] = footprintCorners({ ...b, anchor: { ...b.anchor, heading_deg: 90 } });
  assert.ok(turned.lat > b.anchor.lat && turned.lng > b.anchor.lng, 'turned clockwise: model north-west is now north-east');
});

test('evidence markers come only from recorded locations on the building', () => {
  const b = manifest.buildings[0];
  const location = { id: 9, case_id: 1, kind: 'witness_position', address: 'Behind counter', lat: null, lng: null, building_id: 5, geometry: { component: 'fur_f0_counter', offset: [0, 1, 0] }, origin: 'investigator', review_status: 'confirmed' };
  const workspace = { locations: [location], links: [{ evidence_id: 3, target_type: 'location', target_id: 9 }], evidence: [{ id: 3, title: 'Till receipt', type: 'document' }] } as unknown as CaseWorkspace;
  assert.deepEqual(buildingMarkers(workspace, b), [], 'no markers until the building has a database row');
  const markers = buildingMarkers(workspace, { ...b, db_id: 5 });
  assert.equal(markers.length, 1);
  assert.equal(markers[0].component, 'fur_f0_counter');
  assert.deepEqual(markers[0].evidence.map((e) => e.title), ['Till receipt']);
  assert.deepEqual(buildingMarkers({ ...workspace, locations: [{ ...location, review_status: 'rejected' }] } as unknown as CaseWorkspace, { ...b, db_id: 5 }), []);
});
