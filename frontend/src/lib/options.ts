// Allowed values for form selects, in display order. Labels come from humanize().
import {
  CasePriority,
  CaseStatus,
  Certainty,
  EventCategory,
  EvidenceType,
  IncidentType,
  LocationKind,
  ObjectKind,
  PersonCondition,
  PersonRole,
  RelationshipKind,
  TimePrecision
} from '@/types/api';

export const CASE_STATUSES: CaseStatus[] = ['open', 'in_progress', 'under_review', 'closed'];
export const CASE_PRIORITIES: CasePriority[] = ['critical', 'high', 'medium', 'low'];
export const INCIDENT_TYPES: IncidentType[] = ['road_accident', 'homicide', 'assault', 'burglary', 'fire', 'other'];
export const EVIDENCE_TYPES: EvidenceType[] = ['document', 'statement', 'photo', 'video', 'audio', 'medical', 'other'];
export const PERSON_ROLES: PersonRole[] = ['victim', 'witness', 'suspect', 'other'];
export const PERSON_CONDITIONS: PersonCondition[] = ['uninjured', 'injured', 'deceased'];
export const OBJECT_KINDS: ObjectKind[] = ['vehicle', 'phone', 'weapon', 'item'];
export const LOCATION_KINDS: LocationKind[] = ['incident_site', 'witness_position', 'vehicle_position', 'zone', 'boundary'];
export const EVENT_CATEGORIES: EventCategory[] = ['collision', 'movement', 'witness', 'emergency', 'medical', 'investigation', 'other'];
export const TIME_PRECISIONS: TimePrecision[] = ['exact', 'minute', 'approximate', 'day'];
export const CERTAINTIES: Certainty[] = ['established', 'hypothesis', 'disputed'];
export const RELATIONSHIP_KINDS: RelationshipKind[] = [
  'drove',
  'owns',
  'involved_in',
  'witnessed',
  'located_at',
  'mentions',
  'supports',
  'contradicts',
  'other'
];
