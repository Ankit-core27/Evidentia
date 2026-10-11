// Request and response types for the API contract in docs/PLAN.md.
// They alias src/lib/api-types.ts, which `npm run gen:api` generates from the
// backend's /openapi.json (run it with the backend on port 8000 after any schema
// change). Only what OpenAPI can't express is written by hand here: query
// filters, the error body, and a few narrower field types noted below.
import type { components } from '@/lib/api-types';

type Schemas = components['schemas'];

export type Id = number;
/** ISO 8601 date-time string, such as 2026-10-03T21:40:12Z. */
export type IsoDateTime = string;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type CaseStatus = Schemas['Case']['status'];
export type CasePriority = Schemas['Case']['priority'];
export type IncidentType = Schemas['Case']['incident_type'];
export type EvidenceType = Schemas['Evidence']['type'];
export type ProcessingStatus = Schemas['Evidence']['processing_status'];
export type Origin = Schemas['Person']['origin'];
export type ReviewStatus = Schemas['Person']['review_status'];
export type PersonRole = Schemas['Person']['role'];
export type PersonCondition = NonNullable<Schemas['Person']['condition']>;
export type ObjectKind = Schemas['CaseObject']['kind'];
export type LocationKind = Schemas['Location']['kind'];
export type EventCategory = Schemas['CaseEvent']['category'];
export type TimePrecision = Schemas['CaseEvent']['time_precision'];
export type Certainty = Schemas['CaseEvent']['certainty'];
export type RelationshipKind = Schemas['Relationship']['kind'];
export type ConflictStatus = Schemas['Conflict']['status'];
export type AuditAction = Schemas['AuditEntry']['action'];
export type AnnotationKind = Schemas['SceneAnnotation']['kind'];
export type InjurySeverity = Schemas['Injury']['severity'];
export type ReportTemplate = Schemas['Report']['template'];
export type AlertSeverity = Schemas['Alert']['severity'];
export type AlertKind = Schemas['Alert']['kind'];

/** Record types that relationships, links and audit entries can point at. */
export type RecordType = Schemas['AuditEntry']['record_type'];

/** Records the graph can draw as nodes. */
export type GraphNodeType = Schemas['GraphNode']['type'];

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

/** Carried by persons, objects, locations, events, relationships, observations and injuries. */
export interface Reviewable {
  origin: Origin;
  review_status: ReviewStatus;
}

/** FastAPI error body: a message for 4xx raised by the app, a list for 422 validation errors. */
export interface ApiErrorBody {
  detail: string | { loc: (string | number)[]; msg: string; type: string }[];
}

// ---------------------------------------------------------------------------
// Investigators and cases
// ---------------------------------------------------------------------------

export type Investigator = Schemas['Investigator'];
export type Case = Schemas['Case'];
/** A row of GET /api/cases. */
export type CaseListItem = Schemas['CaseListItem'];
export type CaseCreate = Schemas['CaseCreate'];
export type CaseUpdate = Schemas['CaseUpdate'];

export interface CaseFilters {
  q?: string;
  status?: CaseStatus;
  priority?: CasePriority;
}

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

export type Evidence = Schemas['Evidence'];
/** A row of GET /api/evidence, which spans every case. */
export type EvidenceListItem = Schemas['EvidenceListItem'];
/** GET /api/evidence/{id}. */
export type EvidenceDetail = Schemas['EvidenceDetail'];
export type EvidenceUpdate = Schemas['EvidenceUpdate'];
export type EvidenceLink = Schemas['EvidenceLink'];
export type EvidenceLinkCreate = Schemas['EvidenceLinkCreate'];
export type AuditEntry = Schemas['AuditEntry'];
/** POST /api/cases/{id}/verify. */
export type VerifyResult = Schemas['VerifyResult'];

export interface EvidenceFilters {
  q?: string;
  type?: EvidenceType;
}

// ---------------------------------------------------------------------------
// People, objects and locations
// ---------------------------------------------------------------------------

export type Person = Schemas['Person'];
export type PersonCreate = Schemas['PersonCreate'];
export type PersonUpdate = Schemas['PersonUpdate'];

/** The keys the UI reads from an object's free-form `details`. */
export interface ObjectDetails {
  plate?: string;
  number?: string;
  make?: string;
  colour?: string;
  [key: string]: unknown;
}

export type CaseObject = Omit<Schemas['CaseObject'], 'details'> & { details: ObjectDetails };
export type CaseObjectCreate = Schemas['CaseObjectCreate'];
export type CaseObjectUpdate = Schemas['CaseObjectUpdate'];

export type Location = Schemas['Location'];
export type LocationCreate = Schemas['LocationCreate'];
export type LocationUpdate = Schemas['LocationUpdate'];

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export type CaseEvent = Schemas['CaseEvent'];
export type CaseEventCreate = Schemas['CaseEventCreate'];
export type CaseEventUpdate = Schemas['CaseEventUpdate'];

// ---------------------------------------------------------------------------
// Graph
// ---------------------------------------------------------------------------

export type Relationship = Schemas['Relationship'];
export type RelationshipCreate = Schemas['RelationshipCreate'];
export type RelationshipUpdate = Schemas['RelationshipUpdate'];
export type GraphNode = Schemas['GraphNode'];
export type GraphEdge = Schemas['GraphEdge'];
export type CaseGraph = Schemas['CaseGraph'];

// ---------------------------------------------------------------------------
// AI review
// ---------------------------------------------------------------------------

export type Observation = Schemas['Observation'];
export type ObservationUpdate = Schemas['ObservationUpdate'];
export type Conflict = Schemas['Conflict'];
export type ConflictUpdate = Schemas['ConflictUpdate'];

// ---------------------------------------------------------------------------
// Search and cited answers
// ---------------------------------------------------------------------------

export type AskTurn = Schemas['AskTurn'];
export type AskRequest = Schemas['AskRequest'];
export type Citation = Schemas['Citation'];
export type AskResponse = Schemas['AskResponse'];
export type SearchHit = Schemas['SearchHit'];

// ---------------------------------------------------------------------------
// Injuries (M5)
// ---------------------------------------------------------------------------

export type Injury = Schemas['Injury'];
export type InjuryCreate = Schemas['InjuryCreate'];
export type InjuryUpdate = Schemas['InjuryUpdate'];
export type AnatomyFinding = Schemas['AnatomyFinding'];
export type MedicalDetails = Schemas['MedicalDetails'];
export type MarkerPlacement = Schemas['MarkerPlacement'];
export type MedicalAnalysisRequest = Schemas['MedicalAnalysisRequest'];
export type MedicalAnalysisResult = Schemas['MedicalAnalysisResult'];

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------

/** GET /api/cases/{id}/workspace. Counts are computed by the backend, never stored. */
export type CaseWorkspace = Omit<Schemas['CaseWorkspace'], 'objects'> & { objects: CaseObject[] };

// ---------------------------------------------------------------------------
// Reconstruction
// ---------------------------------------------------------------------------

export type Vec3 = [number, number, number];

export type Reconstruction = Schemas['Reconstruction'];
export type ReconstructionCreate = Schemas['ReconstructionCreate'];
export type SceneObject = Schemas['SceneObject'];
export type SceneObjectInput = Schemas['SceneObjectInput'];
export type ReconstructionStage = Schemas['ReconstructionStage'];
export type StageCreate = Schemas['StageCreate'];
export type SceneAnnotation = Schemas['SceneAnnotation'];
export type SceneAnnotationCreate = Schemas['SceneAnnotationCreate'];
/** GET /api/reconstructions/{id}. */
export type ReconstructionDetail = Schemas['ReconstructionDetail'];

// ---------------------------------------------------------------------------
// Reports and audit
// ---------------------------------------------------------------------------

/** Both flags default on in a request, and a stored report always carries both. */
export type ReportOptions = Required<Schemas['ReportOptions']>;
export type ReportCreate = Schemas['ReportCreate'];
export type ReportContent = Schemas['ReportContent'];
export type Report = Omit<Schemas['Report'], 'options'> & { options: ReportOptions };
/** A row of GET /api/cases/{id}/reports. */
export type ReportListItem = Omit<Schemas['ReportListItem'], 'options'> & { options: ReportOptions };

// ---------------------------------------------------------------------------
// Dashboard and alerts
// ---------------------------------------------------------------------------

export type InvestigatorWithStats = Schemas['InvestigatorWithStats'];
export type IncidentPoint = Schemas['IncidentPoint'];
/** `status_counts` has every status as a key (OpenAPI only says "string keys"). */
export type Dashboard = Omit<Schemas['Dashboard'], 'status_counts'> & { status_counts: Record<CaseStatus, number> };
export type Alert = Schemas['Alert'];
