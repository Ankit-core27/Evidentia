// Mock implementation of every route in the API contract (docs/PLAN.md).
// Behaviour is deliberately simple; where the real backend uses Gemini, the mock
// uses keyword matching over the seed text.
import anatomyManifest from '../../../assets/3d/anatomy/manifest.json';
import { humanize } from '@/lib/format';
import {
  AskRequest,
  AskResponse,
  AuditEntry,
  Case,
  CaseEvent,
  CaseGraph,
  CaseListItem,
  CaseObject,
  CaseStatus,
  Citation,
  Conflict,
  Dashboard,
  Evidence,
  EvidenceDetail,
  EvidenceListItem,
  EvidenceType,
  GraphNode,
  GraphNodeType,
  Id,
  Injury,
  Location,
  Observation,
  Person,
  RecordType,
  Relationship,
  Report,
  ReportContent,
  ReportTemplate,
  Reviewable,
  ReviewStatus,
  SceneObject,
  SearchHit,
  VerifyResult,
  Alert
} from '@/types/api';
import { addAudit, Chunk, chunkText, MockDb, nextId, nowIso, StoredEvidence } from './db';
import { sha256Hex } from './files';
import { created, idParam, invalid, MockHttpError, MockRequest, MockRouter, noContent, notFound, ok } from './router';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const findCase = (db: MockDb, id: Id) => db.cases.find((c) => c.id === id) ?? notFound('Case');

const contains = (haystack: string | null | undefined, q: string) =>
  (haystack ?? '').toLowerCase().includes(q.toLowerCase());

const publicEvidence = ({ extracted_text: _text, ...evidence }: StoredEvidence): Evidence => evidence;

const evidenceListItem = (db: MockDb, e: StoredEvidence): EvidenceListItem => {
  const c = db.cases.find((x) => x.id === e.case_id)!;
  return { ...publicEvidence(e), case_number: c.case_number, case_title: c.title };
};

const caseListItem = (db: MockDb, c: Case): CaseListItem => ({
  ...c,
  evidence_count: db.evidence.filter((e) => e.case_id === c.id).length
});

/** Tables whose rows the AI can propose, with the record type used in audit entries and links. */
const reviewTables = (db: MockDb): [RecordType, (Reviewable & { case_id: Id })[]][] => [
  ['person', db.persons],
  ['object', db.objects],
  ['location', db.locations],
  ['event', db.events],
  ['relationship', db.relationships],
  ['observation', db.observations],
  ['injury', db.injuries],
  ['anatomy_finding', db.anatomyFindings]
];

const caseCounts = (db: MockDb, caseId: Id) => {
  const aiItems = reviewTables(db).flatMap(([, rows]) => rows.filter((r) => r.case_id === caseId && r.origin === 'ai'));
  return {
    evidence: db.evidence.filter((e) => e.case_id === caseId).length,
    pending_reviews: aiItems.filter((r) => r.review_status === 'pending').length,
    open_conflicts: db.conflicts.filter((c) => c.case_id === caseId && c.status === 'open').length,
    ai_items_total: aiItems.length,
    ai_items_reviewed: aiItems.filter((r) => r.review_status !== 'pending').length
  };
};

/** Applies a PATCH, writing an audit entry with the before and after values. */
const patchRecord = <T extends { id: Id }>(
  req: MockRequest,
  row: T,
  recordType: RecordType,
  allowed: (keyof T)[]
): T => {
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  for (const key of allowed) {
    if (req.body && key in req.body && JSON.stringify(req.body[key]) !== JSON.stringify(row[key])) {
      changes[key as string] = { before: row[key], after: req.body[key] };
      row[key] = req.body[key];
    }
  }
  if (Object.keys(changes).length) {
    const onlyReview = Object.keys(changes).every((k) => k === 'review_status');
    addAudit(req.db, req.actorId, onlyReview ? 'reviewed' : 'modified', recordType, row.id, changes);
  }
  return row;
};

const requireFields = (body: any, fields: string[]) => {
  for (const field of fields) {
    if (body?.[field] === undefined || body[field] === null || body[field] === '') invalid(field, 'Field required');
  }
};

const removeLinksTo = (db: MockDb, type: RecordType, id: Id) => {
  db.links = db.links.filter((l) => !(l.target_type === type && l.target_id === id));
};

/** Relationships can't outlive either end. */
const removeRelationshipsOf = (db: MockDb, type: GraphNodeType, id: Id) => {
  const touches = (r: Relationship) => (r.from_type === type && r.from_id === id) || (r.to_type === type && r.to_id === id);
  db.relationships.filter(touches).forEach((r) => removeLinksTo(db, 'relationship', r.id));
  db.relationships = db.relationships.filter((r) => !touches(r));
};

const evidenceTypeFor = (mime: string): EvidenceType => {
  if (mime.startsWith('image/')) return 'photo';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf' || mime.includes('word') || mime.startsWith('text/')) return 'document';
  return 'other';
};

// ---------------------------------------------------------------------------
// Processing simulation
// ---------------------------------------------------------------------------

const isTextLike = (mime: string) => mime.startsWith('text/') || mime === 'application/json';

/**
 * queued → processing → done (or failed for file names containing "fail"),
 * like the FastAPI background task. Text files get their text extracted and
 * one pending AI observation, so the review queue has something new to show.
 */
const simulateProcessing = (db: MockDb, evidenceId: Id) => {
  const row = () => db.evidence.find((e) => e.id === evidenceId);
  setTimeout(() => {
    const e = row();
    if (e) e.processing_status = 'processing';
  }, 1200);
  setTimeout(async () => {
    const e = row();
    if (!e) return;
    db.processedAt.set(e.id, nowIso());
    if (e.title.toLowerCase().includes('fail')) {
      e.processing_status = 'failed';
      e.summary = 'Processing failed (simulated by the mock for file names containing "fail").';
      return;
    }
    const file = db.files.get(e.id);
    if (file && isTextLike(e.mime_type)) {
      const text = await file.text();
      e.extracted_text = text;
      chunkText(db, e.id, text);
      const firstSentence = text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s/)[0]?.slice(0, 200) ?? '';
      e.summary = `Mock summary: ${text.split(/\s+/).filter(Boolean).length} words of text. Starts: "${firstSentence}"`;
      if (firstSentence) {
        const observation: Observation = {
          id: nextId(db.observations),
          case_id: e.case_id,
          subject_type: 'evidence',
          subject_id: e.id,
          statement: firstSentence,
          observed_at: null,
          author_id: null,
          origin: 'ai',
          review_status: 'pending'
        };
        db.observations.push(observation);
        const chunk = db.chunks.find((c) => c.evidence_id === e.id);
        db.links.push({
          id: nextId(db.links),
          evidence_id: e.id,
          chunk_id: chunk?.id ?? null,
          target_type: 'observation',
          target_id: observation.id,
          passage: firstSentence
        });
      }
    } else {
      e.extracted_text = null;
      e.summary = `Mock summary: ${humanize(e.type).toLowerCase()} file received. Text extraction, OCR and transcription run on the real backend.`;
    }
    e.processing_status = 'done';
  }, 4000);
};

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

const STOPWORDS = new Set(
  'the a an and or of to in on at for by with what when who whom which was were is are be been did does do it its this that from as about any there their they he she his her i my me we our you your how why where after before into than then so not no has have had'.split(
    ' '
  )
);

const tokens = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9.:\s-]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^[.:-]+|[.:-]+$/g, ''))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));

const rankChunks = (db: MockDb, caseId: Id, q: string) => {
  const terms = [...new Set(tokens(q))];
  if (!terms.length) return [];
  const evidenceIds = new Set(db.evidence.filter((e) => e.case_id === caseId).map((e) => e.id));
  return db.chunks
    .filter((c) => evidenceIds.has(c.evidence_id))
    .map((chunk) => {
      const words = tokens(chunk.text);
      const hits = terms.filter((t) => words.some((w) => w.startsWith(t) || (t.startsWith(w) && w.length > 3)));
      const score = hits.length / terms.length + (contains(chunk.text, q.trim()) ? 0.5 : 0);
      return { chunk, score: Math.round(score * 100) / 100 };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
};

const citationFor = (db: MockDb, chunk: Chunk): Citation => ({
  chunk_id: chunk.id,
  evidence_id: chunk.evidence_id,
  evidence_title: db.evidence.find((e) => e.id === chunk.evidence_id)?.title ?? 'Evidence',
  page: chunk.page,
  passage: chunk.text
});

const FOLLOW_UPS: Record<number, string[]> = {
  1: [
    "What colour was the hatchback's signal when it entered the junction?",
    'When did the van move off, according to the CCTV?',
    'What do the two witness statements disagree on?',
    'What injuries did Rohan Kapoor have?',
    'Who called 112, and when?',
    'Is there a witness who has not been identified?'
  ]
};

const answerQuestion = (db: MockDb, caseId: Id, body: AskRequest): AskResponse => {
  const ranked = rankChunks(db, caseId, body.question).slice(0, 3);
  const asked = new Set([body.question, ...body.history.filter((t) => t.role === 'user').map((t) => t.content)]);
  const pool = FOLLOW_UPS[caseId] ?? ['Summarise the evidence in this case.', 'Who are the witnesses?', 'What happened first?'];
  const follow_ups = pool.filter((q) => !asked.has(q)).slice(0, 3);
  if (!ranked.length) {
    return {
      answer: "I couldn't find anything about that in this case's evidence. Try naming a person, vehicle, place or time.",
      citations: [],
      follow_ups
    };
  }
  const citations = ranked.map((r) => citationFor(db, r.chunk));
  const lines = citations.map((c, i) => {
    const sentence =
      c.passage
        .split(/(?<=[.!?])\s+/)
        .map((s) => ({ s, score: tokens(body.question).filter((t) => contains(s, t)).length }))
        .sort((a, b) => b.score - a.score)[0]?.s ?? c.passage;
    return `${i + 1}. ${c.evidence_title}: "${sentence.trim()}"`;
  });
  return {
    answer: `Mock answer (keyword match, not Gemini). The most relevant passages in this case's evidence are:\n${lines.join('\n')}`,
    citations,
    follow_ups
  };
};

// ---------------------------------------------------------------------------
// Graph
// ---------------------------------------------------------------------------

const graphFor = (db: MockDb, caseId: Id): CaseGraph => {
  const relationships = db.relationships.filter((r) => r.case_id === caseId);
  const referenced = new Set(relationships.flatMap((r) => [`${r.from_type}:${r.from_id}`, `${r.to_type}:${r.to_id}`]));
  const node = (type: GraphNodeType, record_id: Id, label: string, sublabel: string | null, review_status: ReviewStatus): GraphNode => ({
    id: `${type}:${record_id}`,
    type,
    record_id,
    label,
    sublabel,
    review_status
  });
  const nodes: GraphNode[] = [
    ...db.persons
      .filter((p) => p.case_id === caseId)
      .map((p) => node('person', p.id, p.name, [humanize(p.role), p.condition].filter(Boolean).join(', '), p.review_status)),
    ...db.objects
      .filter((o) => o.case_id === caseId)
      .map((o) => node('object', o.id, o.label, o.details.plate ?? humanize(o.kind), o.review_status)),
    ...db.locations
      .filter((l) => l.case_id === caseId && referenced.has(`location:${l.id}`))
      .map((l) => node('location', l.id, l.address, humanize(l.kind), l.review_status)),
    ...db.evidence
      .filter((e) => e.case_id === caseId && referenced.has(`evidence:${e.id}`))
      .map((e) => node('evidence', e.id, e.title, humanize(e.type), 'confirmed'))
  ];
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = relationships
    .filter((r) => nodeIds.has(`${r.from_type}:${r.from_id}`) && nodeIds.has(`${r.to_type}:${r.to_id}`))
    .map((r) => ({
    id: `relationship:${r.id}`,
    relationship_id: r.id,
    source: `${r.from_type}:${r.from_id}`,
    target: `${r.to_type}:${r.to_id}`,
    kind: r.kind,
    label: r.label,
    confidence: r.confidence,
    flagged: r.flagged,
    review_status: r.review_status
  }));
  return { nodes, edges };
};

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

const buildReport = async (db: MockDb, caseId: Id, template: ReportTemplate, includeAi: boolean, includeCustody: boolean, actorId: Id | null) => {
  const c = findCase(db, caseId);
  const lead = db.investigators.find((i) => i.id === c.lead_investigator_id);
  const evidence = db.evidence.filter((e) => e.case_id === caseId);
  const persons = db.persons.filter((p) => p.case_id === caseId && p.review_status !== 'rejected');
  const events = db.events
    .filter((e) => e.case_id === caseId && e.review_status !== 'rejected')
    .sort((a, b) => (a.time_start ?? '').localeCompare(b.time_start ?? ''));
  const observations = db.observations.filter((o) => o.case_id === caseId);
  const linkedEvidence = (type: RecordType, id: Id) =>
    [...new Set(db.links.filter((l) => l.target_type === type && l.target_id === id).map((l) => l.evidence_id))];
  const medicalOnly = template === 'medical';

  const content: ReportContent = {
    case: { ...c, lead_investigator_name: lead?.name ?? null },
    summary: c.description,
    evidence: evidence
      .filter((e) => !medicalOnly || e.type === 'medical')
      .map(({ id, title, type, sha256, size_bytes, collected_at }) => ({ id, title, type, sha256, size_bytes, collected_at })),
    timeline: template === 'court' || template === 'summary' ? events : [],
    persons,
    confirmed_findings: [
      ...observations.filter((o) => o.review_status === 'confirmed' && (!medicalOnly || o.subject_type === 'person'))
        .map((o) => ({ statement: o.statement, evidence_ids: linkedEvidence('observation', o.id) })),
      ...(template === 'court' || medicalOnly ? db.anatomyFindings.filter(f => f.case_id === caseId && f.review_status === 'confirmed').map(f => ({
        statement: `${db.persons.find(p => p.id === f.person_id)?.name ?? 'Unassigned person'} — ${f.body_region}: ${f.description}${f.medical_details?.uncertainty ? ` Uncertainty: ${f.medical_details.uncertainty}` : ''}`,
        evidence_ids: linkedEvidence('anatomy_finding', f.id)
      })) : [])
    ],
    open_conflicts:
      template === 'court' || template === 'summary'
        ? db.conflicts
            .filter((x) => x.case_id === caseId && x.status === 'open')
            .map((x) => ({
              description: x.description,
              statements: x.observation_ids.map((id) => observations.find((o) => o.id === id)?.statement ?? '')
            }))
        : [],
    uncertainties:
      template === 'court' || template === 'summary'
        ? [
            ...events.filter((e) => e.certainty !== 'established').map((e) => `${e.description} (${e.certainty})`),
            ...(caseCounts(db, caseId).pending_reviews
              ? [`${caseCounts(db, caseId).pending_reviews} AI-proposed items are still waiting for review.`]
              : [])
          ]
        : [],
    reconstructions:
      template === 'court'
        ? db.reconstructions
            .filter((r) => r.case_id === caseId)
            .map(({ scenario, version, assumptions }) => ({ scenario, version, assumptions }))
        : [],
    injuries: template === 'court' || medicalOnly ? db.injuries.filter((i) => i.case_id === caseId && i.review_status !== 'rejected') : [],
    ai_insights:
      includeAi && template !== 'custody'
        ? evidence.filter((e) => e.summary && (!medicalOnly || e.type === 'medical')).map((e) => `${e.title}: ${e.summary}`)
        : null,
    custody:
      includeCustody || template === 'custody'
        ? db.audit.filter((a) => a.record_type === 'evidence' && evidence.some((e) => e.id === a.record_id))
        : null
  };

  const report: Report = {
    id: nextId(db.reports),
    case_id: caseId,
    template,
    options: { include_ai_insights: includeAi, include_custody: includeCustody },
    content,
    sha256: await sha256Hex(new Blob([JSON.stringify(content)])),
    created_by: actorId,
    created_at: nowIso()
  };
  db.reports.push(report);
  addAudit(db, actorId, 'exported', 'report', report.id, { template });
  return report;
};

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------


const validateMedicalMarker = (details: Injury['medical_details'], structureId: string | null) => {
  const marker = details?.marker;
  if (!marker) return;
  const structure = anatomyManifest.structures.find(s => s.id === structureId);
  if (!structure || marker.structure_id !== structureId) invalid('medical_details', 'Marker must reference this injury’s supported structure');
  if ((marker.model_id && marker.model_id !== anatomyManifest.modelId) || (marker.placement_origin && marker.placement_origin !== 'investigator')) invalid('medical_details', 'Invalid marker model or origin');
  if (!Array.isArray(marker.local_position) || marker.local_position.length !== 3 || marker.local_position.some((v, i) => !Number.isFinite(v) || Math.abs(v) > structure!.size[i]/2 + 0.02)) invalid('medical_details', 'Marker lies outside the structure bounds');
};

export const buildRoutes = () => {
  const r = new MockRouter();

  // dashboard ---------------------------------------------------------------

  r.on('GET', '/dashboard', ({ db }) => {
    const statusCounts: Record<CaseStatus, number> = { open: 0, in_progress: 0, under_review: 0, closed: 0 };
    db.cases.forEach((c) => (statusCounts[c.status] += 1));
    const body: Dashboard = {
      total_cases: db.cases.length,
      active_cases: db.cases.filter((c) => c.status !== 'closed').length,
      pending_reviews: db.cases.reduce((sum, c) => sum + caseCounts(db, c.id).pending_reviews, 0),
      storage_bytes: db.evidence.reduce((sum, e) => sum + e.size_bytes, 0),
      status_counts: statusCounts,
      incident_points: db.locations
        .filter((l) => l.kind === 'incident_site' && l.lat !== null && l.lng !== null)
        .map((l) => {
          const c = db.cases.find((x) => x.id === l.case_id)!;
          return {
            case_id: c.id,
            case_number: c.case_number,
            title: c.title,
            incident_type: c.incident_type,
            priority: c.priority,
            address: l.address,
            lat: l.lat!,
            lng: l.lng!,
            incident_at: c.incident_at
          };
        }),
      investigators: db.investigators.map((i) => ({
        ...i,
        solved_cases: db.cases.filter((c) => c.lead_investigator_id === i.id && c.status === 'closed').length,
        active_cases: db.cases.filter((c) => c.investigator_ids.includes(i.id) && c.status !== 'closed').length
      }))
    };
    return ok(body);
  });

  r.on('GET', '/alerts', ({ db }) => {
    const alerts: Alert[] = [];
    for (const c of db.cases) {
      for (const conflict of db.conflicts.filter((x) => x.case_id === c.id && x.status === 'open')) {
        alerts.push({
          id: `conflict-${conflict.id}`,
          kind: 'conflict',
          severity: 'warning',
          title: 'Conflicting statements',
          message: conflict.description,
          case_id: c.id,
          case_number: c.case_number,
          record_type: 'conflict',
          record_id: conflict.id,
          created_at: c.updated_at
        });
      }
      const pending = caseCounts(db, c.id).pending_reviews;
      if (pending) {
        alerts.push({
          id: `review-${c.id}`,
          kind: 'review',
          severity: 'info',
          title: `${pending} AI proposals to review`,
          message: `New people, events, links or statements were proposed from the evidence in ${c.case_number}.`,
          case_id: c.id,
          case_number: c.case_number,
          record_type: null,
          record_id: null,
          created_at: c.updated_at
        });
      }
    }
    for (const [evidenceId, processedAt] of db.processedAt) {
      const e = db.evidence.find((x) => x.id === evidenceId);
      if (!e) continue;
      const c = db.cases.find((x) => x.id === e.case_id)!;
      alerts.push({
        id: `processing-${e.id}-${processedAt}`,
        kind: 'processing',
        severity: e.processing_status === 'failed' ? 'critical' : 'info',
        title: e.processing_status === 'failed' ? 'Processing failed' : 'Processing finished',
        message: e.title,
        case_id: c.id,
        case_number: c.case_number,
        record_type: 'evidence',
        record_id: e.id,
        created_at: processedAt
      });
    }
    alerts.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return ok(alerts);
  });

  // cases -------------------------------------------------------------------

  r.on('GET', '/investigators', ({ db }) => ok(db.investigators));

  r.on('GET', '/cases', ({ db, query }) => {
    const q = query.get('q') ?? '';
    const status = query.get('status');
    const priority = query.get('priority');
    const rows = db.cases
      .filter((c) => !status || c.status === status)
      .filter((c) => !priority || c.priority === priority)
      .filter((c) => {
        if (!q) return true;
        const lead = db.investigators.find((i) => i.id === c.lead_investigator_id);
        const places = db.locations.filter((l) => l.case_id === c.id).map((l) => l.address);
        const people = db.persons.filter((p) => p.case_id === c.id).map((p) => p.name);
        return [c.case_number, c.title, c.description, lead?.name, ...places, ...people].some((t) => contains(t, q));
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return ok(rows.map((c) => caseListItem(db, c)));
  });

  r.on('POST', '/cases', (req) => {
    const { db, body } = req;
    requireFields(body, ['title', 'incident_type', 'priority']);
    const now = nowIso();
    const year = new Date().getFullYear();
    const id = nextId(db.cases);
    const c: Case = {
      id,
      case_number: `FX-${year}-${String(id).padStart(4, '0')}`,
      title: body.title,
      incident_type: body.incident_type,
      status: body.status ?? 'open',
      priority: body.priority,
      description: body.description ?? '',
      incident_at: body.incident_at ?? null,
      lead_investigator_id: body.lead_investigator_id ?? null,
      investigator_ids: body.investigator_ids ?? [],
      created_at: now,
      updated_at: now
    };
    db.cases.push(c);
    addAudit(db, req.actorId, 'modified', 'case', c.id, { created: true });
    return created(c);
  });

  r.on('GET', '/cases/:id', (req) => ok(findCase(req.db, idParam(req))));

  r.on('PATCH', '/cases/:id', (req) => {
    const c = findCase(req.db, idParam(req));
    patchRecord(req, c, 'case', [
      'title',
      'incident_type',
      'status',
      'priority',
      'description',
      'incident_at',
      'lead_investigator_id',
      'investigator_ids'
    ]);
    c.updated_at = nowIso();
    return ok(c);
  });

  r.on('GET', '/cases/:id/workspace', (req) => {
    const { db } = req;
    const caseId = idParam(req);
    const byCase = <T extends { case_id: Id }>(rows: T[]) => rows.filter((row) => row.case_id === caseId);
    return ok({
      case: findCase(db, caseId),
      persons: byCase(db.persons),
      objects: byCase(db.objects),
      locations: byCase(db.locations),
      evidence: byCase(db.evidence).map(publicEvidence),
      events: byCase(db.events),
      relationships: byCase(db.relationships),
      injuries: byCase(db.injuries),
      links: db.links.filter((l) => db.evidence.some((e) => e.id === l.evidence_id && e.case_id === caseId)),
      counts: caseCounts(db, caseId)
    });
  });

  // evidence ----------------------------------------------------------------

  r.on('GET', '/evidence', ({ db, query }) => {
    const q = query.get('q') ?? '';
    const type = query.get('type');
    const rows = db.evidence
      .filter((e) => !type || e.type === type)
      .map((e) => evidenceListItem(db, e))
      .filter((e) => !q || [e.title, e.description, e.case_number, e.case_title, e.summary].some((t) => contains(t, q)))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return ok(rows);
  });

  r.on('POST', '/cases/:id/evidence', async (req) => {
    const { db } = req;
    const caseId = findCase(db, idParam(req)).id;
    const files = (req.form?.getAll('files') ?? []).filter((f): f is File => f instanceof File);
    if (!files.length) invalid('files', 'At least one file is required');
    const createdRows: Evidence[] = [];
    for (const file of files) {
      const mime = file.type || 'application/octet-stream';
      const row: StoredEvidence = {
        id: nextId(db.evidence),
        case_id: caseId,
        type: evidenceTypeFor(mime),
        title: file.name,
        description: '',
        notes: '',
        mime_type: mime,
        size_bytes: file.size,
        sha256: await sha256Hex(file),
        collected_at: null,
        source: '',
        processing_status: 'queued',
        summary: null,
        created_at: nowIso(),
        extracted_text: null
      };
      db.evidence.push(row);
      db.files.set(row.id, file);
      addAudit(db, req.actorId, 'uploaded', 'evidence', row.id, { file_name: file.name, sha256: row.sha256 });
      simulateProcessing(db, row.id);
      createdRows.push(publicEvidence(row));
    }
    return created(createdRows);
  });

  r.on('GET', '/cases/:id/evidence', (req) => {
    const caseId = findCase(req.db, idParam(req)).id;
    return ok(req.db.evidence.filter((e) => e.case_id === caseId).map(publicEvidence));
  });

  r.on('GET', '/evidence/:id', (req) => {
    const { db } = req;
    const e = db.evidence.find((x) => x.id === idParam(req)) ?? notFound('Evidence');
    const body: EvidenceDetail = {
      ...evidenceListItem(db, e),
      extracted_text: e.extracted_text,
      links: db.links.filter((l) => l.evidence_id === e.id),
      custody: db.audit.filter((a) => a.record_type === 'evidence' && a.record_id === e.id)
    };
    return ok(body);
  });

  r.on('PATCH', '/evidence/:id', (req) => {
    const e = req.db.evidence.find((x) => x.id === idParam(req)) ?? notFound('Evidence');
    patchRecord(req, e, 'evidence', ['type', 'title', 'description', 'notes']);
    return ok(publicEvidence(e));
  });

  r.on('GET', '/evidence/:id/file', (req) => {
    const e = req.db.evidence.find((x) => x.id === idParam(req)) ?? notFound('Evidence');
    const file = req.db.files.get(e.id) ?? notFound('File');
    const download = req.query.get('download') === '1';
    addAudit(req.db, req.actorId, download ? 'exported' : 'viewed', 'evidence', e.id);
    return ok(file);
  });

  r.on('POST', '/evidence/:id/reprocess', (req) => {
    const e = req.db.evidence.find((x) => x.id === idParam(req)) ?? notFound('Evidence');
    e.processing_status = 'queued';
    // Lets a simulated failure succeed on the second try.
    e.title = e.title.replace(/fail/gi, 'retry');
    addAudit(req.db, req.actorId, 'modified', 'evidence', e.id, { reprocess: true });
    simulateProcessing(req.db, e.id);
    return ok(publicEvidence(e));
  });

  r.on('POST', '/evidence-links', (req) => {
    const { db, body } = req;
    requireFields(body, ['evidence_id', 'target_type', 'target_id']);
    if (!db.evidence.some((e) => e.id === body.evidence_id)) notFound('Evidence');
    const link = {
      id: nextId(db.links),
      evidence_id: body.evidence_id,
      chunk_id: body.chunk_id ?? null,
      target_type: body.target_type,
      target_id: body.target_id,
      passage: body.passage ?? null
    };
    db.links.push(link);
    addAudit(db, req.actorId, 'modified', body.target_type, body.target_id, { linked_evidence: body.evidence_id });
    return created(link);
  });

  r.on('DELETE', '/evidence-links/:id', (req) => {
    const id = idParam(req);
    const link = req.db.links.find((l) => l.id === id) ?? notFound('Evidence link');
    req.db.links = req.db.links.filter((l) => l.id !== id);
    addAudit(req.db, req.actorId, 'modified', link.target_type, link.target_id, { unlinked_evidence: link.evidence_id });
    return noContent();
  });

  r.on('POST', '/cases/:id/verify', async (req) => {
    const { db } = req;
    const caseId = findCase(db, idParam(req)).id;
    const result: VerifyResult = { checked: 0, mismatches: [], verified_at: nowIso() };
    for (const e of db.evidence.filter((x) => x.case_id === caseId)) {
      const file = db.files.get(e.id);
      if (!file) continue; // The mock has no file for some seed evidence (the CCTV clip).
      result.checked += 1;
      const actual = await sha256Hex(file);
      if (actual !== e.sha256) result.mismatches.push({ evidence_id: e.id, title: e.title, expected: e.sha256, actual });
    }
    addAudit(db, req.actorId, 'reviewed', 'case', caseId, { integrity_check: { checked: result.checked, mismatches: result.mismatches.length } });
    return ok(result);
  });

  // people ------------------------------------------------------------------

  const resource = <T extends Reviewable & { id: Id; case_id: Id }>(
    collection: string,
    recordType: RecordType,
    table: (db: MockDb) => T[],
    setTable: (db: MockDb, rows: T[]) => void,
    required: string[],
    editable: (keyof T)[],
    defaults: (body: any) => Omit<T, 'id' | 'case_id' | 'origin' | 'review_status'>
  ) => {
    r.on('GET', `/cases/:id/${collection}`, (req) => {
      const caseId = findCase(req.db, idParam(req)).id;
      return ok(table(req.db).filter((row) => row.case_id === caseId));
    });
    r.on('POST', `/cases/:id/${collection}`, (req) => {
      const caseId = findCase(req.db, idParam(req)).id;
      requireFields(req.body, required);
      const row = {
        ...defaults(req.body),
        id: nextId(table(req.db)),
        case_id: caseId,
        origin: 'investigator',
        review_status: 'confirmed'
      } as T;
      table(req.db).push(row);
      addAudit(req.db, req.actorId, 'modified', recordType, row.id, { created: true });
      return created(row);
    });
    r.on('PATCH', `/${collection}/:id`, (req) => {
      const row = table(req.db).find((x) => x.id === idParam(req)) ?? notFound(humanize(recordType));
      return ok(patchRecord(req, row, recordType, [...editable, 'review_status'] as (keyof T)[]));
    });
    r.on('DELETE', `/${collection}/:id`, (req) => {
      const id = idParam(req);
      const caseIdOf = (table(req.db).find((x) => x.id === id) ?? notFound(humanize(recordType))).case_id;
      setTable(req.db, table(req.db).filter((x) => x.id !== id));
      if (recordType === 'person') {
        for (const finding of [...req.db.injuries, ...req.db.anatomyFindings]) if (finding.person_id === id) finding.person_id = null;
      }
      removeLinksTo(req.db, recordType, id);
      removeRelationshipsOf(req.db, recordType as GraphNodeType, id);
      addAudit(req.db, req.actorId, 'modified', recordType, id, { deleted: true, case_id: caseIdOf });
      return noContent();
    });
  };

  resource<Person>(
    'persons',
    'person',
    (db) => db.persons,
    (db, rows) => (db.persons = rows),
    ['role', 'name'],
    ['role', 'name', 'age', 'occupation', 'condition', 'contact', 'notes', 'details'],
    (b) => ({
      role: b.role,
      name: b.name,
      age: b.age ?? null,
      occupation: b.occupation ?? '',
      condition: b.condition ?? null,
      contact: b.contact ?? '',
      notes: b.notes ?? '',
      details: b.details ?? {}
    })
  );
  resource<CaseObject>(
    'objects',
    'object',
    (db) => db.objects,
    (db, rows) => (db.objects = rows),
    ['kind', 'label'],
    ['kind', 'label', 'details'],
    (b) => ({ kind: b.kind, label: b.label, details: b.details ?? {} })
  );
  resource<Location>(
    'locations',
    'location',
    (db) => db.locations,
    (db, rows) => (db.locations = rows),
    ['kind', 'address'],
    ['kind', 'address', 'lat', 'lng', 'geometry', 'building_id'],
    (b) => ({
      kind: b.kind,
      address: b.address,
      lat: b.lat ?? null,
      lng: b.lng ?? null,
      geometry: b.geometry ?? null,
      building_id: b.building_id ?? null
    })
  );

  // search ------------------------------------------------------------------

  // Questions containing "[fail]" fail once, so the retry path can be tried.
  const failedOnce = new Set<string>();
  r.on('POST', '/cases/:id/ask', (req) => {
    const caseId = findCase(req.db, idParam(req)).id;
    requireFields(req.body, ['question']);
    if (req.body.question.includes('[fail]') && !failedOnce.has(req.body.question)) {
      failedOnce.add(req.body.question);
      throw new MockHttpError(503, { detail: 'The AI service is unavailable (simulated once by the mock for questions containing [fail]).' });
    }
    return ok(answerQuestion(req.db, caseId, { question: req.body.question, history: req.body.history ?? [] }));
  });

  r.on('GET', '/cases/:id/search', (req) => {
    const caseId = findCase(req.db, idParam(req)).id;
    const hits: SearchHit[] = rankChunks(req.db, caseId, req.query.get('q') ?? '')
      .slice(0, 20)
      .map(({ chunk, score }) => ({ ...citationFor(req.db, chunk), score }));
    return ok(hits);
  });

  // review ------------------------------------------------------------------

  r.on('GET', '/cases/:id/observations', (req) => {
    const caseId = findCase(req.db, idParam(req)).id;
    const status = req.query.get('status');
    return ok(req.db.observations.filter((o) => o.case_id === caseId && (!status || o.review_status === status)));
  });

  r.on('PATCH', '/observations/:id', (req) => {
    const o = req.db.observations.find((x) => x.id === idParam(req)) ?? notFound('Observation');
    return ok(patchRecord(req, o, 'observation', ['statement', 'review_status']));
  });

  r.on('GET', '/cases/:id/conflicts', (req) => {
    const caseId = findCase(req.db, idParam(req)).id;
    return ok(req.db.conflicts.filter((c) => c.case_id === caseId));
  });

  r.on('PATCH', '/conflicts/:id', (req) => {
    const c: Conflict = req.db.conflicts.find((x) => x.id === idParam(req)) ?? notFound('Conflict');
    return ok(patchRecord(req, c, 'conflict', ['status']));
  });

  // graph -------------------------------------------------------------------

  r.on('GET', '/cases/:id/graph', (req) => ok(graphFor(req.db, findCase(req.db, idParam(req)).id)));

  r.on('POST', '/cases/:id/relationships', (req) => {
    const { db, body } = req;
    const caseId = findCase(db, idParam(req)).id;
    requireFields(body, ['from_type', 'from_id', 'to_type', 'to_id', 'kind']);
    const rel: Relationship = {
      id: nextId(db.relationships),
      case_id: caseId,
      from_type: body.from_type,
      from_id: body.from_id,
      to_type: body.to_type,
      to_id: body.to_id,
      kind: body.kind,
      label: body.label ?? humanize(body.kind),
      confidence: body.confidence ?? null,
      flagged: body.flagged ?? false,
      notes: body.notes ?? '',
      origin: 'investigator',
      review_status: 'confirmed'
    };
    db.relationships.push(rel);
    addAudit(db, req.actorId, 'modified', 'relationship', rel.id, { created: true });
    return created(rel);
  });

  r.on('PATCH', '/relationships/:id', (req) => {
    const rel = req.db.relationships.find((x) => x.id === idParam(req)) ?? notFound('Relationship');
    return ok(patchRecord(req, rel, 'relationship', ['kind', 'label', 'confidence', 'flagged', 'notes', 'review_status']));
  });

  r.on('DELETE', '/relationships/:id', (req) => {
    const id = idParam(req);
    const caseIdOf = (req.db.relationships.find((x) => x.id === id) ?? notFound('Relationship')).case_id;
    req.db.relationships = req.db.relationships.filter((x) => x.id !== id);
    removeLinksTo(req.db, 'relationship', id);
    addAudit(req.db, req.actorId, 'modified', 'relationship', id, { deleted: true, case_id: caseIdOf });
    return noContent();
  });

  // timeline ----------------------------------------------------------------

  r.on('GET', '/cases/:id/events', (req) => {
    const caseId = findCase(req.db, idParam(req)).id;
    const category = req.query.get('category');
    return ok(
      req.db.events
        .filter((e) => e.case_id === caseId && (!category || e.category === category))
        .sort((a, b) => (a.time_start ?? '').localeCompare(b.time_start ?? ''))
    );
  });

  r.on('POST', '/cases/:id/events', (req) => {
    const { db, body } = req;
    const caseId = findCase(db, idParam(req)).id;
    requireFields(body, ['category', 'description']);
    const event: CaseEvent = {
      id: nextId(db.events),
      case_id: caseId,
      location_id: body.location_id ?? null,
      category: body.category,
      time_start: body.time_start ?? null,
      time_end: body.time_end ?? null,
      time_precision: body.time_precision ?? 'minute',
      certainty: body.certainty ?? 'established',
      description: body.description,
      ai_note: body.ai_note ?? null,
      origin: 'investigator',
      review_status: 'confirmed'
    };
    db.events.push(event);
    addAudit(db, req.actorId, 'modified', 'event', event.id, { created: true });
    return created(event);
  });

  r.on('PATCH', '/events/:id', (req) => {
    const e = req.db.events.find((x) => x.id === idParam(req)) ?? notFound('Event');
    return ok(
      patchRecord(req, e, 'event', [
        'location_id',
        'category',
        'time_start',
        'time_end',
        'time_precision',
        'certainty',
        'description',
        'ai_note',
        'review_status'
      ])
    );
  });

  r.on('DELETE', '/events/:id', (req) => {
    const id = idParam(req);
    const caseIdOf = (req.db.events.find((x) => x.id === id) ?? notFound('Event')).case_id;
    req.db.events = req.db.events.filter((x) => x.id !== id);
    req.db.stages.forEach((s) => (s.event_ids = s.event_ids.filter((eventId) => eventId !== id)));
    removeLinksTo(req.db, 'event', id);
    addAudit(req.db, req.actorId, 'modified', 'event', id, { deleted: true, case_id: caseIdOf });
    return noContent();
  });

  // reconstruction ----------------------------------------------------------

  const reconstructionDetail = (db: MockDb, id: Id) => {
    const rec = db.reconstructions.find((x) => x.id === id) ?? notFound('Reconstruction');
    return {
      ...rec,
      scene: rec.scene ?? null,
      stages: db.stages
        .filter((s) => s.reconstruction_id === id)
        .sort((a, b) => a.stage_order - b.stage_order)
        .map((s) => ({ ...s, scene_objects: db.sceneObjects.filter((o) => o.stage_id === s.id) })),
      annotations: db.annotations.filter((a) => a.reconstruction_id === id)
    };
  };

  r.on('GET', '/cases/:id/reconstructions', (req) => {
    const caseId = findCase(req.db, idParam(req)).id;
    return ok(req.db.reconstructions.filter((x) => x.case_id === caseId));
  });

  r.on('POST', '/cases/:id/reconstructions', (req) => {
    const { db, body } = req;
    const caseId = findCase(db, idParam(req)).id;
    requireFields(body, ['scenario']);
    const rec = {
      id: nextId(db.reconstructions),
      case_id: caseId,
      scenario: body.scenario,
      version: 1,
      assumptions: body.assumptions ?? '',
      scene_file: body.scene_file ?? null,
      origin: 'investigator' as const
    };
    db.reconstructions.push(rec);
    addAudit(db, req.actorId, 'modified', 'reconstruction', rec.id, { created: true });
    return created(rec);
  });

  // Generating needs the backend's planners (Gemini or the rules), which the mock doesn't have.
  r.on('POST', '/cases/:id/reconstructions/generate', (req) => {
    findCase(req.db, idParam(req));
    throw new MockHttpError(503, {
      detail: 'Generating a reconstruction from the evidence needs the backend. Run it with `npm run dev` and the API on port 8000.'
    });
  });

  r.on('GET', '/reconstructions/:id', (req) => ok(reconstructionDetail(req.db, idParam(req))));

  r.on('POST', '/reconstructions/:id/stages', (req) => {
    const { db, body } = req;
    const reconstructionId = idParam(req);
    if (!db.reconstructions.some((x) => x.id === reconstructionId)) notFound('Reconstruction');
    requireFields(body, ['label']);
    const siblings = db.stages.filter((s) => s.reconstruction_id === reconstructionId);
    const stage = {
      id: nextId(db.stages),
      reconstruction_id: reconstructionId,
      stage_order: body.stage_order ?? siblings.length + 1,
      label: body.label,
      event_ids: body.event_ids ?? []
    };
    db.stages.push(stage);
    addAudit(db, req.actorId, 'modified', 'stage', stage.id, { created: true });
    return created(stage);
  });

  r.on('PUT', '/stages/:id/scene-objects', (req) => {
    const { db } = req;
    const stageId = idParam(req);
    if (!db.stages.some((s) => s.id === stageId)) notFound('Stage');
    if (!Array.isArray(req.body)) invalid('body', 'Expected a list of scene objects');
    db.sceneObjects = db.sceneObjects.filter((o) => o.stage_id !== stageId);
    const placed: SceneObject[] = (req.body as Omit<SceneObject, 'id' | 'stage_id'>[]).map((o) => {
      const row = { ...o, id: nextId(db.sceneObjects), stage_id: stageId };
      db.sceneObjects.push(row);
      return row;
    });
    addAudit(db, req.actorId, 'modified', 'stage', stageId, { scene_objects: placed.length });
    return ok(placed);
  });

  r.on('GET', '/reconstructions/:id/annotations', (req) => {
    const id = idParam(req);
    return ok(req.db.annotations.filter((a) => a.reconstruction_id === id));
  });

  r.on('POST', '/reconstructions/:id/annotations', (req) => {
    const { db, body } = req;
    const reconstructionId = idParam(req);
    if (!db.reconstructions.some((x) => x.id === reconstructionId)) notFound('Reconstruction');
    requireFields(body, ['kind']);
    const annotation = {
      id: nextId(db.annotations),
      reconstruction_id: reconstructionId,
      stage_id: body.stage_id ?? null,
      kind: body.kind,
      data: body.data ?? {}
    };
    db.annotations.push(annotation);
    addAudit(db, req.actorId, 'modified', 'annotation', annotation.id, { created: true });
    return created(annotation);
  });

  // Medical findings share the existing mock records, review and audit machinery.
  r.on('GET', '/health', () => ok({ status: 'ok', ai_enabled: false }));
  r.on('GET', '/cases/:id/anatomy-findings', (req) => {
    const caseId = findCase(req.db, idParam(req)).id;
    return ok(req.db.anatomyFindings.filter(f => f.case_id === caseId));
  });
  r.on('PATCH', '/anatomy-findings/:id', (req) => {
    const finding = req.db.anatomyFindings.find(f => f.id === idParam(req)) ?? notFound('Anatomical finding');
    if (Object.keys(req.body).some(k => k !== 'review_status')) invalid('body', 'Only review_status can be updated');
    if (!['pending', 'confirmed', 'rejected'].includes(req.body.review_status)) invalid('review_status', 'Invalid review status');
    return ok(patchRecord(req, finding, 'anatomy_finding', ['review_status']));
  });
  r.on('POST', '/cases/:id/medical-analysis', (req) => {
    const caseId = findCase(req.db, idParam(req)).id;
    if (!req.db.persons.some(p => p.id === req.body.person_id && p.case_id === caseId && p.review_status !== 'rejected')) invalid('person_id', 'Person is not in this case');
    if (!req.db.evidence.some(e => e.id === req.body.evidence_id && e.case_id === caseId)) invalid('evidence_id', 'Evidence is not in this case');
    if (!['medical', 'postmortem'].includes(req.body.report_kind)) invalid('report_kind', 'Invalid report classification');
    const report = req.db.evidence.find(e => e.id === req.body.evidence_id)!;
    if (!['medical', 'document'].includes(report.type) || report.processing_status !== 'done' || !report.extracted_text) invalid('evidence_id', 'Select a processed medical report or document');
    throw new MockHttpError(503, { detail: 'Live medical extraction is unavailable in mock mode. Stored findings and reference anatomy remain available.' });
  });

  // injuries ----------------------------------------------------------------

  r.on('GET', '/cases/:id/injuries', (req) => {
    const caseId = findCase(req.db, idParam(req)).id;
    return ok(req.db.injuries.filter((i) => i.case_id === caseId));
  });

  r.on('POST', '/cases/:id/injuries', (req) => {
    const { db, body } = req;
    const caseId = findCase(db, idParam(req)).id;
    requireFields(body, ['body_region', 'type', 'severity']);
    validateMedicalMarker(body.medical_details, body.structure_id ?? null);
    const injury: Injury = {
      id: nextId(db.injuries),
      case_id: caseId,
      person_id: body.person_id ?? null,
      body_region: body.body_region,
      structure_id: body.structure_id ?? null,
      medical_details: body.medical_details ?? {},
      type: body.type,
      severity: body.severity,
      depth: body.depth ?? null,
      estimated_time: body.estimated_time ?? null,
      description: body.description ?? '',
      origin: 'investigator',
      review_status: 'confirmed'
    };
    db.injuries.push(injury);
    addAudit(db, req.actorId, 'modified', 'injury', injury.id, { created: true });
    return created(injury);
  });

  // Proposed addition to the contract: injuries are AI proposals and need review.
  r.on('PATCH', '/injuries/:id', (req) => {
    const injury = req.db.injuries.find((x) => x.id === idParam(req)) ?? notFound('Injury');
    if (req.body.medical_details === null) invalid('medical_details', 'Field cannot be null');
    validateMedicalMarker(req.body.medical_details ?? injury.medical_details, req.body.structure_id === undefined ? injury.structure_id : req.body.structure_id);
    return ok(
      patchRecord(req, injury, 'injury', [
        'person_id',
        'body_region',
        'structure_id',
        'type',
        'severity',
        'depth',
        'estimated_time',
        'description',
        'medical_details',
        'review_status'
      ])
    );
  });

  // buildings (M6, M7) ------------------------------------------------------

  r.on('GET', '/buildings/:id', () => notFound('Building (the building viewer arrives in M6)'));

  // reports -----------------------------------------------------------------

  r.on('POST', '/cases/:id/reports', async (req) => {
    const caseId = findCase(req.db, idParam(req)).id;
    requireFields(req.body, ['template']);
    const options = req.body.options ?? {};
    return created(
      await buildReport(req.db, caseId, req.body.template, !!options.include_ai_insights, !!options.include_custody, req.actorId)
    );
  });

  r.on('GET', '/reports/:id', (req) => ok(req.db.reports.find((x) => x.id === idParam(req)) ?? notFound('Report')));

  r.on('GET', '/cases/:id/reports', (req) => {
    const caseId = findCase(req.db, idParam(req)).id;
    return ok(
      req.db.reports
        .filter((x) => x.case_id === caseId)
        .map(({ content: _content, ...row }) => row)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
    );
  });

  r.on('GET', '/cases/:id/audit', (req) => {
    const { db } = req;
    const caseId = findCase(db, idParam(req)).id;
    const owned: Partial<Record<RecordType, Set<Id>>> = {
      case: new Set([caseId]),
      evidence: new Set(db.evidence.filter((e) => e.case_id === caseId).map((e) => e.id)),
      report: new Set(db.reports.filter((x) => x.case_id === caseId).map((x) => x.id)),
      reconstruction: new Set(db.reconstructions.filter((x) => x.case_id === caseId).map((x) => x.id)),
      conflict: new Set(db.conflicts.filter((x) => x.case_id === caseId).map((x) => x.id))
    };
    for (const [type, rows] of reviewTables(db)) owned[type] = new Set(rows.filter((x) => x.case_id === caseId).map((x) => (x as unknown as { id: Id }).id));
    const recIds = owned.reconstruction!;
    owned.stage = new Set(db.stages.filter((s) => recIds.has(s.reconstruction_id)).map((s) => s.id));
    owned.annotation = new Set(db.annotations.filter((a) => recIds.has(a.reconstruction_id)).map((a) => a.id));
    const entries: AuditEntry[] = db.audit
      .filter((a) => owned[a.record_type]?.has(a.record_id) || a.detail?.case_id === caseId)
      .sort((a, b) => b.at.localeCompare(a.at));
    return ok(entries);
  });

  return r;
};
