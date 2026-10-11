// In-memory tables for the mock backend. Shapes follow src/types/api.ts; the extra
// fields (extracted_text, chunks, files) are what the real backend keeps server-side.
import {
  AnatomyFinding,
  AuditAction,
  AuditEntry,
  Case,
  CaseEvent,
  CaseObject,
  Conflict,
  Evidence,
  EvidenceLink,
  Id,
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

export interface StoredEvidence extends Evidence {
  extracted_text: string | null;
}

export interface Chunk {
  id: Id;
  evidence_id: Id;
  page: number | null;
  text: string;
}

export interface MockDb {
  investigators: Investigator[];
  cases: Case[];
  evidence: StoredEvidence[];
  chunks: Chunk[];
  links: EvidenceLink[];
  persons: Person[];
  objects: CaseObject[];
  locations: Location[];
  events: CaseEvent[];
  relationships: Relationship[];
  observations: Observation[];
  conflicts: Conflict[];
  injuries: Injury[];
  anatomyFindings: AnatomyFinding[];
  reconstructions: Reconstruction[];
  stages: ReconstructionStage[];
  sceneObjects: SceneObject[];
  annotations: SceneAnnotation[];
  reports: Report[];
  audit: AuditEntry[];
  /** Original files by evidence id. */
  files: Map<Id, Blob>;
  /** When processing finished for evidence uploaded in this session; drives the alerts feed. */
  processedAt: Map<Id, string>;
}

type Table = { id: Id }[];

export const nextId = (table: Table) => table.reduce((max, row) => Math.max(max, row.id), 0) + 1;

export const nowIso = () => new Date().toISOString();

export const addAudit = (
  db: MockDb,
  actorId: Id | null,
  action: AuditAction,
  recordType: RecordType,
  recordId: Id,
  detail: Record<string, unknown> | null = null,
  at = nowIso()
) => {
  const actor = db.investigators.find((i) => i.id === actorId) ?? null;
  const entry: AuditEntry = {
    id: nextId(db.audit),
    actor_id: actor?.id ?? null,
    actor_name: actor?.name ?? null,
    action,
    record_type: recordType,
    record_id: recordId,
    at,
    detail
  };
  db.audit.push(entry);
  return entry;
};

/** Splits extracted text into chunks: one per paragraph, keeping page numbers for PDFs. */
export const chunkText = (db: MockDb, evidenceId: Id, text: string, pages?: string[]) => {
  db.chunks = db.chunks.filter((c) => c.evidence_id !== evidenceId);
  const sources = pages ? pages.map((p, i) => ({ page: i + 1, text: p })) : [{ page: null, text }];
  for (const source of sources) {
    for (const paragraph of source.text.split(/\n\s*\n/)) {
      const trimmed = paragraph.trim();
      if (trimmed) db.chunks.push({ id: nextId(db.chunks), evidence_id: evidenceId, page: source.page, text: trimmed });
    }
  }
};

/** Finds the chunk that contains a passage, for evidence links and citations. */
export const chunkFor = (db: MockDb, evidenceId: Id, passage: string) =>
  db.chunks.find((c) => c.evidence_id === evidenceId && c.text.includes(passage)) ?? null;
