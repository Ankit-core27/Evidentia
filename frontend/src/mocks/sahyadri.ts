// The Sahyadri Chowk case (FX-2026-0005) for mock mode. sahyadri.json is exported from
// the real backend seed (backend/scripts/export_mock_case.py), so this case looks the
// same with and without the backend: its records, links, both scenarios with their
// generated 3D scenes, and its report.
import {
  AuditEntry,
  Case,
  CaseEvent,
  CaseObject,
  Conflict,
  Injury,
  Investigator,
  Location,
  Observation,
  Person,
  Reconstruction,
  ReconstructionStage,
  RecordType,
  Relationship,
  Report,
  SceneAnnotation,
  SceneObject
} from '@/types/api';
import { chunkFor, chunkText, MockDb, nextId, StoredEvidence } from './db';
import { makePdf, sha256Hex } from './files';
import fixture from './sahyadri.json';

interface Fixture {
  investigators: Investigator[];
  case: Case;
  evidence: (StoredEvidence & { pages: string[] })[];
  persons: Person[];
  objects: CaseObject[];
  locations: Location[];
  events: CaseEvent[];
  relationships: Relationship[];
  observations: Observation[];
  conflicts: Conflict[];
  injuries: Injury[];
  reconstructions: (Reconstruction & { scene: Record<string, unknown> | null })[];
  stages: ReconstructionStage[];
  sceneObjects: SceneObject[];
  annotations: SceneAnnotation[];
  reports: Report[];
  links: { evidence_id: number; target_type: RecordType; target_id: number; passage: string }[];
  audit: AuditEntry[];
}

const data = fixture as unknown as Fixture;

/** Adds rows that keep the backend's ids, refusing any id the mock seed already uses. */
function addRows<T extends { id: number }>(table: T[], rows: T[], name: string) {
  const taken = new Set(table.map((r) => r.id));
  const clash = rows.find((r) => taken.has(r.id));
  if (clash) throw new Error(`Sahyadri Chowk ${name} ${clash.id} clashes with the mock seed; re-run export_mock_case.py`);
  table.push(...rows);
}

export async function addSahyadriCase(db: MockDb) {
  addRows(db.investigators, data.investigators, 'investigator');
  addRows(db.cases, [data.case], 'case');

  for (const { pages, ...row } of data.evidence) {
    // The PDF is rebuilt here, so its size and hash are those of the file the mock serves.
    const file = makePdf(pages);
    const evidence: StoredEvidence = { ...row, size_bytes: file.size, sha256: await sha256Hex(file) };
    addRows(db.evidence, [evidence], 'evidence');
    db.files.set(evidence.id, file);
    if (evidence.extracted_text) chunkText(db, evidence.id, evidence.extracted_text, pages);
  }

  addRows(db.persons, data.persons, 'person');
  addRows(db.objects, data.objects, 'object');
  addRows(db.locations, data.locations, 'location');
  addRows(db.events, data.events, 'event');
  addRows(db.relationships, data.relationships, 'relationship');
  addRows(db.observations, data.observations, 'observation');
  addRows(db.conflicts, data.conflicts, 'conflict');
  addRows(db.injuries, data.injuries, 'injury');
  addRows(db.reconstructions, data.reconstructions, 'reconstruction');
  addRows(db.stages, data.stages, 'stage');
  addRows(db.sceneObjects, data.sceneObjects, 'scene object');
  addRows(db.annotations, data.annotations, 'annotation');
  addRows(db.reports, data.reports, 'report');

  for (const l of data.links) {
    const chunk = chunkFor(db, l.evidence_id, l.passage);
    if (!chunk) throw new Error(`Sahyadri Chowk passage not found in evidence ${l.evidence_id}: ${l.passage}`);
    db.links.push({ id: nextId(db.links), evidence_id: l.evidence_id, chunk_id: chunk.id, target_type: l.target_type, target_id: l.target_id, passage: l.passage });
  }

  // Renumbered with the rest of the audit trail once the seed is built.
  db.audit.push(...data.audit);
}
