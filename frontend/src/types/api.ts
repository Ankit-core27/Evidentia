// Request and response types for the API contract in docs/PLAN.md.
// Hand-written until the backend publishes /openapi.json; then `npm run gen:api`
// generates src/lib/api-types.ts and these become aliases of the generated types.
// Field names and enum values follow the "Contract assumptions" in docs/FRONTEND_TASKS.md.

export type Id = number;
/** ISO 8601 date-time string, such as 2026-10-03T21:40:12Z. */
export type IsoDateTime = string;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type CaseStatus = 'open' | 'in_progress' | 'under_review' | 'closed';
export type CasePriority = 'critical' | 'high' | 'medium' | 'low';
export type IncidentType = 'road_accident' | 'homicide' | 'assault' | 'burglary' | 'fire' | 'other';
export type EvidenceType = 'document' | 'statement' | 'photo' | 'video' | 'audio' | 'medical' | 'other';
export type ProcessingStatus = 'queued' | 'processing' | 'done' | 'failed';
export type Origin = 'ai' | 'investigator';
export type ReviewStatus = 'pending' | 'confirmed' | 'rejected';
export type PersonRole = 'victim' | 'witness' | 'suspect' | 'other';
export type PersonCondition = 'uninjured' | 'injured' | 'deceased';
export type ObjectKind = 'vehicle' | 'phone' | 'weapon' | 'item';
export type LocationKind = 'incident_site' | 'witness_position' | 'vehicle_position' | 'zone' | 'boundary';
export type EventCategory = 'collision' | 'movement' | 'witness' | 'emergency' | 'medical' | 'investigation' | 'other';
export type TimePrecision = 'exact' | 'minute' | 'approximate' | 'day';
export type Certainty = 'established' | 'hypothesis' | 'disputed';
export type RelationshipKind =
  | 'drove'
  | 'owns'
  | 'involved_in'
  | 'witnessed'
  | 'located_at'
  | 'mentions'
  | 'supports'
  | 'contradicts'
  | 'other';
export type ConflictStatus = 'open' | 'resolved';
export type AuditAction = 'uploaded' | 'viewed' | 'modified' | 'reviewed' | 'exported';
export type AnnotationKind = 'note' | 'measurement' | 'viewpoint';
export type InjurySeverity = 'minor' | 'moderate' | 'severe' | 'fatal';
export type ReportTemplate = 'court' | 'summary' | 'custody' | 'medical';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertKind = 'conflict' | 'processing' | 'review';

/** Record types that relationships, links and audit entries can point at. */
export type RecordType =
  | 'case'
  | 'evidence'
  | 'person'
  | 'object'
  | 'location'
  | 'event'
  | 'relationship'
  | 'observation'
  | 'conflict'
  | 'injury'
  | 'reconstruction'
  | 'stage'
  | 'scene_object'
  | 'annotation'
  | 'report';

/** Records the graph can draw as nodes. */
export type GraphNodeType = 'person' | 'object' | 'location' | 'evidence';

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

/** Carried by persons, objects, locations, events, relationships, observations and injuries. */
export interface Reviewable {
  origin: Origin;
  review_status: ReviewStatus;
}

/** FastAPI error body. */
export interface ApiErrorBody {
  detail: string | { loc: (string | number)[]; msg: string; type: string }[];
}

// ---------------------------------------------------------------------------
// Investigators and cases
// ---------------------------------------------------------------------------

export interface Investigator {
  id: Id;
  name: string;
  badge_number: string;
  role: string;
  clearance_level: string;
}

export interface Case {
  id: Id;
  case_number: string;
  title: string;
  incident_type: IncidentType;
  status: CaseStatus;
  priority: CasePriority;
  description: string;
  incident_at: IsoDateTime | null;
  lead_investigator_id: Id | null;
  investigator_ids: Id[];
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

/** A row of GET /api/cases. */
export interface CaseListItem extends Case {
  evidence_count: number;
}

export interface CaseFilters {
  q?: string;
  status?: CaseStatus;
  priority?: CasePriority;
}

export interface CaseCreate {
  title: string;
  incident_type: IncidentType;
  priority: CasePriority;
  status?: CaseStatus;
  description?: string;
  incident_at?: IsoDateTime | null;
  lead_investigator_id?: Id | null;
  investigator_ids?: Id[];
}

export type CaseUpdate = Partial<CaseCreate>;

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

export interface Evidence {
  id: Id;
  case_id: Id;
  type: EvidenceType;
  title: string;
  description: string;
  notes: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  collected_at: IsoDateTime | null;
  source: string;
  processing_status: ProcessingStatus;
  summary: string | null;
  created_at: IsoDateTime;
}

/** A row of GET /api/evidence, which spans every case. */
export interface EvidenceListItem extends Evidence {
  case_number: string;
  case_title: string;
}

export interface EvidenceFilters {
  q?: string;
  type?: EvidenceType;
}

export interface EvidenceLink {
  id: Id;
  evidence_id: Id;
  chunk_id: Id | null;
  target_type: RecordType;
  target_id: Id;
  passage: string | null;
}

export interface EvidenceLinkCreate {
  evidence_id: Id;
  chunk_id?: Id | null;
  target_type: RecordType;
  target_id: Id;
  passage?: string | null;
}

export interface AuditEntry {
  id: Id;
  actor_id: Id | null;
  actor_name: string | null;
  action: AuditAction;
  record_type: RecordType;
  record_id: Id;
  at: IsoDateTime;
  /** Before and after values for modifications, or other context. */
  detail: Record<string, unknown> | null;
}

/** GET /api/evidence/{id}. */
export interface EvidenceDetail extends EvidenceListItem {
  extracted_text: string | null;
  links: EvidenceLink[];
  custody: AuditEntry[];
}

export interface EvidenceUpdate {
  type?: EvidenceType;
  title?: string;
  description?: string;
  notes?: string;
}

/** POST /api/cases/{id}/verify. */
export interface VerifyResult {
  checked: number;
  mismatches: { evidence_id: Id; title: string; expected: string; actual: string | null }[];
  verified_at: IsoDateTime;
}

// ---------------------------------------------------------------------------
// People, objects and locations
// ---------------------------------------------------------------------------

export interface Person extends Reviewable {
  id: Id;
  case_id: Id;
  role: PersonRole;
  name: string;
  age: number | null;
  occupation: string;
  condition: PersonCondition | null;
  contact: string;
  notes: string;
  details: Record<string, unknown>;
}

export interface ObjectDetails {
  plate?: string;
  number?: string;
  make?: string;
  colour?: string;
  [key: string]: unknown;
}

export interface CaseObject extends Reviewable {
  id: Id;
  case_id: Id;
  kind: ObjectKind;
  label: string;
  details: ObjectDetails;
}

export interface Location extends Reviewable {
  id: Id;
  case_id: Id;
  kind: LocationKind;
  address: string;
  lat: number | null;
  lng: number | null;
  /** GeoJSON geometry for zones and boundaries. */
  geometry: Record<string, unknown> | null;
  building_id: Id | null;
}

type CreateOf<T extends Reviewable & { id: Id; case_id: Id }> = Omit<T, 'id' | 'case_id' | 'origin' | 'review_status'>;
type UpdateOf<T extends Reviewable & { id: Id; case_id: Id }> = Partial<CreateOf<T>> & { review_status?: ReviewStatus };

export type PersonCreate = Pick<Person, 'role' | 'name'> & Partial<CreateOf<Person>>;
export type PersonUpdate = UpdateOf<Person>;
export type CaseObjectCreate = Pick<CaseObject, 'kind' | 'label'> & Partial<CreateOf<CaseObject>>;
export type CaseObjectUpdate = UpdateOf<CaseObject>;
export type LocationCreate = Pick<Location, 'kind' | 'address'> & Partial<CreateOf<Location>>;
export type LocationUpdate = UpdateOf<Location>;

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export interface CaseEvent extends Reviewable {
  id: Id;
  case_id: Id;
  location_id: Id | null;
  category: EventCategory;
  time_start: IsoDateTime | null;
  time_end: IsoDateTime | null;
  time_precision: TimePrecision;
  certainty: Certainty;
  description: string;
  ai_note: string | null;
}

export type CaseEventCreate = Pick<CaseEvent, 'category' | 'description'> & Partial<CreateOf<CaseEvent>>;
export type CaseEventUpdate = UpdateOf<CaseEvent>;

// ---------------------------------------------------------------------------
// Graph
// ---------------------------------------------------------------------------

export interface Relationship extends Reviewable {
  id: Id;
  case_id: Id;
  from_type: GraphNodeType;
  from_id: Id;
  to_type: GraphNodeType;
  to_id: Id;
  kind: RelationshipKind;
  label: string;
  confidence: number | null;
  flagged: boolean;
  notes: string;
}

export type RelationshipCreate = Pick<Relationship, 'from_type' | 'from_id' | 'to_type' | 'to_id' | 'kind'> &
  Partial<CreateOf<Relationship>>;
export type RelationshipUpdate = UpdateOf<Relationship>;

export interface GraphNode {
  /** `${type}:${record_id}`, such as "person:3". */
  id: string;
  type: GraphNodeType;
  record_id: Id;
  label: string;
  sublabel: string | null;
  review_status: ReviewStatus;
}

export interface GraphEdge {
  id: string;
  relationship_id: Id;
  source: string;
  target: string;
  kind: RelationshipKind;
  label: string;
  confidence: number | null;
  flagged: boolean;
  review_status: ReviewStatus;
}

export interface CaseGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ---------------------------------------------------------------------------
// AI review
// ---------------------------------------------------------------------------

export interface Observation extends Reviewable {
  id: Id;
  case_id: Id;
  subject_type: RecordType;
  subject_id: Id;
  statement: string;
  observed_at: IsoDateTime | null;
  author_id: Id | null;
}

export interface ObservationUpdate {
  statement?: string;
  review_status?: ReviewStatus;
}

export interface Conflict {
  id: Id;
  case_id: Id;
  observation_ids: Id[];
  description: string;
  status: ConflictStatus;
}

export interface ConflictUpdate {
  status: ConflictStatus;
}

// ---------------------------------------------------------------------------
// Search and cited answers
// ---------------------------------------------------------------------------

export interface AskTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AskRequest {
  question: string;
  history: AskTurn[];
}

export interface Citation {
  chunk_id: Id;
  evidence_id: Id;
  evidence_title: string;
  page: number | null;
  passage: string;
}

export interface AskResponse {
  answer: string;
  citations: Citation[];
  follow_ups: string[];
}

export interface SearchHit extends Citation {
  score: number;
}

// ---------------------------------------------------------------------------
// Injuries (M5)
// ---------------------------------------------------------------------------

export interface Injury extends Reviewable {
  id: Id;
  case_id: Id;
  person_id: Id | null;
  body_region: string;
  structure_id: string | null;
  type: string;
  severity: InjurySeverity;
  depth: string | null;
  estimated_time: IsoDateTime | null;
  description: string;
}

export type InjuryCreate = Pick<Injury, 'body_region' | 'type' | 'severity'> & Partial<CreateOf<Injury>>;

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------

/** GET /api/cases/{id}/workspace. Counts are computed by the backend, never stored. */
export interface CaseWorkspace {
  case: Case;
  persons: Person[];
  objects: CaseObject[];
  locations: Location[];
  evidence: Evidence[];
  events: CaseEvent[];
  relationships: Relationship[];
  injuries: Injury[];
  /** Source passages for every record in the case, so any record can show and open its evidence. */
  links: EvidenceLink[];
  counts: {
    evidence: number;
    pending_reviews: number;
    open_conflicts: number;
    ai_items_total: number;
    ai_items_reviewed: number;
  };
}

// ---------------------------------------------------------------------------
// Reconstruction
// ---------------------------------------------------------------------------

export type Vec3 = [number, number, number];

export interface Reconstruction {
  id: Id;
  case_id: Id;
  scenario: string;
  version: number;
  assumptions: string;
  scene_file: string | null;
}

export interface ReconstructionCreate {
  scenario: string;
  assumptions?: string;
  scene_file?: string | null;
}

export interface SceneObject {
  id: Id;
  stage_id: Id;
  model_id: string;
  object_id: Id | null;
  label: string;
  /** Metres. */
  position: Vec3;
  /** Radians. */
  rotation: Vec3;
  scale: Vec3;
}

export type SceneObjectInput = Omit<SceneObject, 'id' | 'stage_id'>;

export interface ReconstructionStage {
  id: Id;
  reconstruction_id: Id;
  stage_order: number;
  label: string;
  event_ids: Id[];
}

export interface StageCreate {
  label: string;
  stage_order?: number;
  event_ids?: Id[];
}

export interface SceneAnnotation {
  id: Id;
  reconstruction_id: Id;
  stage_id: Id | null;
  kind: AnnotationKind;
  data: Record<string, unknown>;
}

export type SceneAnnotationCreate = Omit<SceneAnnotation, 'id' | 'reconstruction_id'>;

/** GET /api/reconstructions/{id}. */
export interface ReconstructionDetail extends Reconstruction {
  stages: (ReconstructionStage & { scene_objects: SceneObject[] })[];
  annotations: SceneAnnotation[];
}

// ---------------------------------------------------------------------------
// Reports and audit
// ---------------------------------------------------------------------------

export interface ReportOptions {
  include_ai_insights: boolean;
  include_custody: boolean;
}

export interface ReportCreate {
  template: ReportTemplate;
  options: ReportOptions;
}

export interface ReportContent {
  case: Case & { lead_investigator_name: string | null };
  summary: string;
  evidence: Pick<Evidence, 'id' | 'title' | 'type' | 'sha256' | 'size_bytes' | 'collected_at'>[];
  timeline: CaseEvent[];
  persons: Person[];
  confirmed_findings: { statement: string; evidence_ids: Id[] }[];
  open_conflicts: { description: string; statements: string[] }[];
  uncertainties: string[];
  reconstructions: Pick<Reconstruction, 'scenario' | 'version' | 'assumptions'>[];
  injuries: Injury[];
  ai_insights: string[] | null;
  custody: AuditEntry[] | null;
}

export interface Report {
  id: Id;
  case_id: Id;
  template: ReportTemplate;
  options: ReportOptions;
  content: ReportContent;
  sha256: string;
  created_by: Id | null;
  created_at: IsoDateTime;
}

/** A row of the proposed GET /api/cases/{id}/reports. */
export type ReportListItem = Omit<Report, 'content'>;

// ---------------------------------------------------------------------------
// Dashboard and alerts
// ---------------------------------------------------------------------------

export interface InvestigatorWithStats extends Investigator {
  solved_cases: number;
  active_cases: number;
}

export interface IncidentPoint {
  case_id: Id;
  case_number: string;
  title: string;
  incident_type: IncidentType;
  priority: CasePriority;
  address: string;
  lat: number;
  lng: number;
  incident_at: IsoDateTime | null;
}

export interface Dashboard {
  total_cases: number;
  active_cases: number;
  pending_reviews: number;
  storage_bytes: number;
  status_counts: Record<CaseStatus, number>;
  incident_points: IncidentPoint[];
  investigators: InvestigatorWithStats[];
}

export interface Alert {
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  message: string;
  case_id: Id;
  case_number: string;
  record_type: RecordType | null;
  record_id: Id | null;
  created_at: IsoDateTime;
}
