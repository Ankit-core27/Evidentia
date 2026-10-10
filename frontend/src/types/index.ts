export type CaseStatus = 'Open' | 'Forensic Testing' | 'Closed' | 'Under Review';
export type CasePriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface Investigator {
  id: string;
  name: string;
  role: string;
  badgeId: string;
  avatar: string;
  casesSolved: number;
  activeCases: number;
  clearanceLevel: string;
}

export interface PersonOfInterest {
  id: string;
  name: string;
  role: 'Suspect' | 'Victim' | 'Witness' | 'Informant' | 'Associate';
  threatLevel: 'Low' | 'Moderate' | 'High' | 'Severe';
  alibiStatus: 'Verified' | 'Unverified' | 'Conflicting' | 'None';
  avatar?: string;
  notes: string;
  dnaMatch?: string;
}

export interface EvidenceItem {
  id: string;
  caseId: string;
  caseTitle?: string;
  title: string;
  type: 'Autopsy' | 'DNA' | 'GPS' | 'Audio/Transcript' | 'Digital File' | 'Chemical/Tox' | 'Ballistics';
  dateAdded: string;
  fileSize: string;
  sha256: string;
  chainOfCustody: { officer: string; timestamp: string; action: string }[];
  summary: string;
  aiInsights?: string;
  downloadUrl?: string;
  details?: Record<string, string | number | boolean>;
}

export interface TimelineEvent {
  id: string;
  caseId: string;
  timestamp: string;
  timeDisplay: string;
  title: string;
  description: string;
  category: 'GPS' | 'DNA' | 'Witness' | 'Autopsy' | 'Telecom' | 'Financial';
  isAiFlagged: boolean;
  aiBreakthroughReason?: string;
  associatedEvidenceId?: string;
  location?: string;
  confidenceScore?: number;
}

export interface AnatomicalInjury {
  id: string;
  region: 'head' | 'neck' | 'chest' | 'abdomen' | 'left_arm' | 'right_arm' | 'left_leg' | 'right_leg' | 'back';
  title: string;
  type: 'Laceration' | 'Blunt Force Trauma' | 'Gunshot Wound' | 'Toxic Chemical Residue' | 'Defensive Wound' | 'Asphyxiation Mark';
  severity: 'Minor' | 'Moderate' | 'Severe' | 'Fatal';
  depth: string;
  description: string;
  estimatedTimeOfInjury: string;
  aiNotes: string;
  coordinates: { x: number; y: number }; // Percentage position on mannequin SVG/canvas
}

export interface NetworkNode {
  id: string;
  label: string;
  sublabel: string;
  type: 'Suspect' | 'Victim' | 'Evidence' | 'Location' | 'Vehicle' | 'Telecom';
  x: number;
  y: number;
  threatLevel?: 'Low' | 'Medium' | 'High' | 'Severe';
  status?: string;
  color?: string;
}

export interface NetworkLink {
  source: string;
  target: string;
  label: string;
  strength: number; // 1 to 5
  isSuspicious: boolean;
  notes?: string;
}

export interface VictimProfile {
  id: string;
  name: string;
  age: number;
  occupation: string;
  status: 'Deceased - Confirmed' | 'Critically Injured' | 'Recovered' | 'Missing';
  causeOfDeath?: string;
  timeOfDeath?: string;
  dnaMatchVerification?: string;
  autopsySummary?: string;
}

export interface CctvMatch {
  id: string;
  timestamp: string;
  location: string;
  cameraName: string;
  confidenceScore: number;
  subjectDetected: string;
  snapshotUrl?: string;
  aiNotes: string;
}

export interface PhoneCallRecord {
  id: string;
  timestamp: string;
  caller: string;
  receiver: string;
  duration: string;
  location: string;
  encryptionStatus: 'Encrypted' | 'Decrypted' | 'Plaintext';
  flaggedByAi: boolean;
  transcriptSnippet?: string;
}

export interface CopilotMessage {
  id: string;
  sender: 'user' | 'copilot';
  timestamp: string;
  text: string;
  citations?: string[];
  suggestedActions?: string[];
}

export type CaseModule =
  | 'overview'
  | 'evidence'
  | 'people'
  | 'review'
  | 'canvas'
  | 'timeline'
  | 'reconstruction'
  | 'autopsy'
  | 'copilot'
  | 'reports'
  | 'settings';

export interface ForensicCase {
  id: string;
  title: string;
  status: CaseStatus;
  priority: CasePriority;
  leadInvestigator: Investigator;
  dateCreated: string;
  lastUpdated: string;
  incidentLocation: string;
  description: string;
  evidenceCount: number;
  aiConfidenceScore: number;
  victim?: VictimProfile;
  evidenceList: EvidenceItem[];
  personsOfInterest: PersonOfInterest[];
  timeline: TimelineEvent[];
  injuries: AnatomicalInjury[];
  networkNodes: NetworkNode[];
  networkLinks: NetworkLink[];
  cctvMatches?: CctvMatch[];
  phoneRecords?: PhoneCallRecord[];
  progressPercent?: number;
}

export interface IncidentMapPoint {
  id: string;
  caseId: string;
  title: string;
  lat: number;
  lng: number;
  xPercent: number;
  yPercent: number;
  type: 'Homicide' | 'Cyber' | 'Financial' | 'Narcotics' | 'Arson';
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  city: string;
  timestamp: string;
}

export interface SystemAlert {
  id: string;
  timestamp: string;
  title: string;
  message: string;
  caseId: string;
  severity: 'info' | 'warning' | 'critical';
}
