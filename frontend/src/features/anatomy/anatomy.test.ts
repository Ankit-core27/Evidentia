import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Vector3 } from 'three';
import { AnatomyManifest, Finding, buildExplosion, clampProgress, findingState, findingsForPerson, mapFinding, positionAt, skinOpacity, structureBounds, structureStatus } from './anatomyEngine';
import type { AnatomyFinding, EvidenceLink, Injury } from '../../types/api';
import { buildRoutes } from '../../mocks/handlers';
import { MockDb } from '../../mocks/db';
import { MockHttpError } from '../../mocks/router';

const manifest: AnatomyManifest = JSON.parse(readFileSync('../assets/3d/anatomy/manifest.json', 'utf8'));
const transforms = buildExplosion(manifest.structures);
const injury = (changes: Partial<Injury> = {}): Injury => ({ id: 1, case_id: 1, person_id: 1, body_region: 'chest', structure_id: 'clavicle_right', type: 'Fracture', severity: 'moderate', depth: null, estimated_time: null, description: 'Displaced fracture of the right clavicle.', origin: 'ai', review_status: 'confirmed', ...changes });
const finding = (changes: Partial<AnatomyFinding> = {}): AnatomyFinding => ({ id: 1, case_id: 1, person_id: 1, body_region: 'abdomen', structure_id: 'liver', finding_type: 'explicitly_normal', description: 'Liver is normal.', reported_condition: '', medical_details: {}, origin: 'ai', review_status: 'pending', ...changes });
const linked = [{ target_type: 'anatomy_finding', target_id: 1, passage: 'Liver is normal.' }] as EvidenceLink[];

test('shipped GLB matches checksum, independently named source meshes and manifest bounds', () => {
  const bytes = readFileSync('../assets/3d/anatomy/bodyparts3d.glb');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.sha256);
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  assert.equal(manifest.structures.length, 18);
  for (const s of manifest.structures) {
    const node = gltf.nodes.find((n: any) => n.name === s.id);
    assert.deepEqual(node.translation, s.originalPosition);
    assert.deepEqual(node.children.map((i: number) => gltf.nodes[i].name), s.meshNames);
    for (const i of node.children) {
      const mesh = gltf.meshes[gltf.nodes[i].mesh];
      const position = gltf.accessors[mesh.primitives[0].attributes.POSITION];
      assert.ok(position.count > 50, 'Actual segmented geometry, not a placeholder');
      assert.ok(position.min.every((v: number, axis: number) => v >= -s.size[axis]/2 - 0.005));
      assert.ok(position.max.every((v: number, axis: number) => v <= s.size[axis]/2 + 0.005));
    }
  }
});

test('normalized explosion clamps, exposes skin first and returns exactly without drift', () => {
  assert.equal(clampProgress(-1), 0); assert.equal(clampProgress(2), 1); assert.equal(clampProgress(NaN), 0);
  assert.equal(skinOpacity(0), 1); assert.equal(skinOpacity(0.3), 0);
  for (const t of transforms) {
    assert.deepEqual(positionAt(t, 0.2), t.originalPosition);
    assert.deepEqual(positionAt(t, 1), t.explodedPosition);
    for (let i=0; i<100; i++) { positionAt(t, 0.7); positionAt(t, 1); }
    assert.deepEqual(positionAt(t, 0), t.originalPosition);
  }
});

test('exploded actual organ bounds do not overlap and laterality stays correct', () => {
  const organs = transforms.filter(t => t.structureId !== 'skin');
  for (let i=0; i<organs.length; i++) for (let j=i+1; j<organs.length; j++) {
    const a = organs[i], b = organs[j];
    assert.equal(structureBounds(manifest.structures.find(s => s.id === a.structureId)!, a.explodedPosition)
      .intersectsBox(structureBounds(manifest.structures.find(s => s.id === b.structureId)!, b.explodedPosition)), false, `${a.structureId}/${b.structureId}`);
  }
  assert.ok(organs.find(t => t.structureId === 'lung_right')!.explodedPosition[0] < 0);
  assert.ok(organs.find(t => t.structureId === 'lung_left')!.explodedPosition[0] > 0);
});

test('seed injury terminology maps clavicle while forehead and upper-arm trauma stay unresolved', () => {
  const marker = (record: Injury) => mapFinding({ kind: 'injury', record }, manifest.structures);
  assert.equal(marker(injury()).structureId, 'clavicle_right');
  assert.equal(marker(injury({ structure_id: null, body_region: 'Right clavicle' })).structureId, 'clavicle_right');
  assert.equal(marker(injury({ structure_id: null, description: 'No heart injury documented.' })).structureId, null);
  assert.equal(marker(injury({ structure_id: 'skull_frontal', description: 'Forehead laceration.' })).structureId, null);
  assert.equal(marker(injury({ structure_id: null, body_region: 'right_arm', description: 'Bruising to right upper arm.' })).structureId, null);
  assert.equal(marker(injury()).localPosition, null);
});

test('investigator markers remain local and follow the organ through every transform', () => {
  const local: [number, number, number] = [0.01, 0, 0];
  const record = injury({ medical_details: { marker: { structure_id: 'clavicle_right', local_position: local, placement_origin: 'investigator', location_precision: 'regional', model_id: manifest.modelId } } });
  const marker = mapFinding({ kind: 'injury', record }, manifest.structures);
  const transform = transforms.find(t => t.structureId === marker.structureId)!;
  for (const progress of [0, 0.3, 0.75, 1, 0]) {
    const organ = new Vector3(...positionAt(transform, progress));
    const world = organ.clone().add(new Vector3(...marker.localPosition!));
    assert.ok(world.clone().sub(organ).distanceTo(new Vector3(...local)) < 1e-12);
  }
  assert.equal(marker.placementOrigin, 'investigator');
});

test('person and unassigned records never mix', () => {
  const injuries = [injury(), injury({ id: 2, person_id: 2 }), injury({ id: 3, person_id: null })];
  assert.deepEqual(findingsForPerson(injuries, [finding()], 1).map(f => f.record.id), [1, 1]);
  assert.deepEqual(findingsForPerson(injuries, [finding()], 2).map(f => f.record.id), [2]);
  assert.deepEqual(findingsForPerson(injuries, [finding()], null).map(f => f.record.id), [3]);
});

test('normal requires a source; missing, rejected, uncertain and contradictory stay distinct', () => {
  const normal: Finding = { kind: 'anatomy_finding', record: finding() };
  assert.equal(findingState([], linked), 'not_documented');
  assert.equal(findingState([normal], []), 'uncertain');
  assert.equal(findingState([normal], linked), 'explicitly_normal');
  assert.equal(findingState([{ kind: 'anatomy_finding', record: finding({ review_status: 'rejected' }) }], linked), 'not_documented');
  assert.equal(findingState([normal, { kind: 'injury', record: injury() }], linked), 'uncertain');
  assert.equal(findingState([{ kind: 'anatomy_finding', record: finding({ medical_details: { uncertainty: 'Report is contradictory' } }) }], linked), 'uncertain');
});

test('organ status reports the worst recorded severity and counts only non-rejected findings', () => {
  assert.deepEqual(structureStatus([], linked), { state: 'not_documented', worstSeverity: null, injuries: 0, abnormalities: 0, normal: 0, uncertain: 0, pending: 0 });
  const status = structureStatus([
    { kind: 'injury', record: injury() },
    { kind: 'injury', record: injury({ id: 2, severity: 'severe', review_status: 'pending' }) },
    { kind: 'injury', record: injury({ id: 3, severity: 'fatal', review_status: 'rejected' }) },
    { kind: 'anatomy_finding', record: finding({ id: 2, finding_type: 'abnormality', review_status: 'confirmed' }) }
  ], linked);
  assert.deepEqual(status, { state: 'injury_documented', worstSeverity: 'severe', injuries: 2, abnormalities: 1, normal: 0, uncertain: 0, pending: 1 });
  assert.equal(structureStatus([{ kind: 'injury', record: injury({ severity: 'unknown' }) }], linked).worstSeverity, 'unknown');
  const normal = structureStatus([{ kind: 'anatomy_finding', record: finding() }], linked);
  assert.deepEqual([normal.state, normal.worstSeverity, normal.normal, normal.pending], ['explicitly_normal', null, 1, 1]);
});

test('mock anatomy routes preserve case isolation, review audit and explicit no-AI behavior', async () => {
  const db = { cases: [{ id: 1 }, { id: 2 }], persons: [{ id: 1, case_id: 1 }], evidence: [{ id: 1, case_id: 1, type: 'medical', processing_status: 'done', extracted_text: 'Synthetic Patient' }], anatomyFindings: [finding()], audit: [], investigators: [] } as unknown as MockDb;
  const routes = buildRoutes();
  const call = async (method: string, path: string, body: unknown = {}) => {
    const route = routes.match(method, path)!;
    return route.handler({ db, body, params: route.params, query: new URLSearchParams(), form: null, actorId: null });
  };
  assert.deepEqual((await call('GET', '/cases/2/anatomy-findings')).body, []);
  assert.equal((await call('PATCH', '/anatomy-findings/1', { review_status: 'rejected' })).status, 200);
  assert.equal(db.anatomyFindings[0].review_status, 'rejected');
  assert.equal(db.audit[0].record_type, 'anatomy_finding');
  await assert.rejects(call('POST', '/cases/1/medical-analysis', { person_id: 1, evidence_id: 1, report_kind: 'medical' }), (e: unknown) => e instanceof MockHttpError && e.status === 503);
  await assert.rejects(call('POST', '/cases/2/medical-analysis', { person_id: 1, evidence_id: 1, report_kind: 'medical' }), (e: unknown) => e instanceof MockHttpError && e.status === 422);
});
