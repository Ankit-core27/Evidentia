import { Box3, Vector3 } from 'three';
import type { AnatomyFinding, EvidenceLink, Injury, Vec3 } from '../../types/api';

export interface AnatomyStructure {
  id: string;
  label: string;
  system: string;
  meshNames: string[];
  originalPosition: Vec3;
  size: Vec3;
  color: string;
  fma: string;
  triangles: number;
}
export interface AnatomyManifest {
  modelId: 'bodyparts3d-3.0-forensix-v1';
  url: string;
  sha256: string;
  license: string;
  structures: AnatomyStructure[];
}
export interface OrganTransform {
  structureId: string;
  originalPosition: Vec3;
  explodedPosition: Vec3;
  originalRotation: Vec3;
  explodedRotation: Vec3;
}
export type Finding = { kind: 'injury'; record: Injury } | { kind: 'anatomy_finding'; record: AnatomyFinding };
export type FindingState = 'injury_documented' | 'abnormality_documented' | 'explicitly_normal' | 'not_documented' | 'uncertain';
export interface AnatomicalMarker {
  finding: Finding;
  structureId: string | null;
  localPosition: Vec3 | null;
  locationPrecision: 'exact' | 'regional' | 'organ_only' | 'unresolved';
  placementOrigin: 'ai' | 'investigator' | 'model_mapping';
}

export const clampProgress = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
export const smooth = (value: number) => { const x = clampProgress(value); return x*x*(3-2*x); };
export const separationProgress = (progress: number) => smooth((progress - 0.25) / 0.75);
export const skinOpacity = (progress: number) => 1 - smooth(progress / 0.3);
export const positionAt = (transform: OrganTransform, progress: number): Vec3 => {
  const t = separationProgress(progress);
  if (t === 0) return [...transform.originalPosition];
  if (t === 1) return [...transform.explodedPosition];
  return transform.originalPosition.map((v, i) => v + (transform.explodedPosition[i] - v)*t) as Vec3;
};

// Anatomical rows and left/right columns, with actual bounds determining spacing.
// +X is the subject's left. Skin remains in its reference pose and fades out.
const slots: Record<string, [number, number]> = {
  brain: [0, 0], frontal_bone: [0, -2], clavicle_right: [1, -1], clavicle_left: [1, 1],
  lung_right: [2, -1], heart: [2, 0], lung_left: [2, 1],
  liver: [3, -1], stomach: [3, 0], spleen: [3, 1], humerus_right: [3, -2], humerus_left: [3, 2],
  kidney_right: [4, -1], pancreas: [4, 0], kidney_left: [4, 1],
  intestine_small: [5, 0], intestine_large: [6, 0]
};

export function buildExplosion(structures: AnatomyStructure[]): OrganTransform[] {
  const rows = new Map<number, AnatomyStructure[]>();
  for (const s of structures.filter(s => s.id !== 'skin')) {
    const row = slots[s.id]?.[0] ?? 7;
    rows.set(row, [...(rows.get(row) ?? []), s]);
  }
  const positions = new Map<string, Vec3>();
  let top = Math.max(...structures.map(s => s.originalPosition[1] + s.size[1]/2));
  for (const [, items] of [...rows.entries()].sort(([a], [b]) => a-b)) {
    const height = Math.max(...items.map(s => s.size[1]));
    const width = Math.max(...items.map(s => s.size[0])) + 0.09;
    for (const s of items) positions.set(s.id, [(slots[s.id]?.[1] ?? 0)*width, top-height/2, 0.05]);
    top -= height + 0.065;
  }
  return structures.map(s => ({ structureId: s.id, originalPosition: s.originalPosition,
    explodedPosition: positions.get(s.id) ?? s.originalPosition, originalRotation: [0,0,0], explodedRotation: [0,0,0] }));
}

export function structureBounds(structure: AnatomyStructure, position: Vec3): Box3 {
  return new Box3().setFromCenterAndSize(new Vector3(...position), new Vector3(...structure.size));
}

/** Explicit IDs take precedence. Region-only trauma is never reassigned to a nearby organ. */
export function mapFinding(finding: Finding, structures: AnatomyStructure[]): AnatomicalMarker {
  const record = finding.record;
  let id = record.structure_id;
  if (!id) {
    const region = record.body_region.toLowerCase().replaceAll('_', ' ').trim();
    // Only an exact named region is a fallback. Narrative mentions can be negated
    // or refer to another structure; an upper-arm bruise is not a humeral injury.
    const names = structures.filter(s => s.id !== 'skin' && region === s.label.toLowerCase());
    if (names.length === 1) id = names[0].id;
  }
  const structure = structures.find(s => s.id === id);
  const placement = record.medical_details?.marker;
  if (structure && placement?.structure_id === id && placement.model_id === 'bodyparts3d-3.0-forensix-v1') {
    return { finding, structureId: id, localPosition: placement.local_position as Vec3,
      locationPrecision: placement.location_precision ?? 'regional', placementOrigin: 'investigator' };
  }
  return { finding, structureId: structure?.id ?? null, localPosition: null,
    locationPrecision: structure ? 'organ_only' : 'unresolved', placementOrigin: 'model_mapping' };
}

export function findingsForPerson(injuries: Injury[], findings: AnatomyFinding[], personId: number | null): Finding[] {
  return [
    ...injuries.filter(i => i.person_id === personId).map(record => ({ kind: 'injury' as const, record })),
    ...findings.filter(i => i.person_id === personId).map(record => ({ kind: 'anatomy_finding' as const, record }))
  ];
}

export function findingState(findings: Finding[], links: EvidenceLink[]): FindingState {
  const kept = findings.filter(f => f.record.review_status !== 'rejected');
  if (!kept.length) return 'not_documented';
  if (kept.some(f => f.record.medical_details?.assertion === 'contradictory' || f.record.medical_details?.assertion === 'uncertain' || !!f.record.medical_details?.uncertainty)) return 'uncertain';
  const normal = kept.some(f => f.kind === 'anatomy_finding' && f.record.finding_type === 'explicitly_normal');
  const abnormal = kept.some(f => f.kind === 'injury' || f.record.finding_type === 'abnormality');
  if (normal && abnormal) return 'uncertain';
  if (kept.some(f => f.kind === 'injury')) return 'injury_documented';
  if (abnormal) return 'abnormality_documented';
  if (normal && kept.some(f => f.kind === 'anatomy_finding' && f.record.finding_type === 'explicitly_normal'
    && links.some(l => l.target_type === f.kind && l.target_id === f.record.id && !!l.passage))) return 'explicitly_normal';
  return 'uncertain';
}

export const findingKey = (finding: Finding) => `${finding.kind}:${finding.record.id}`;
