import {
  LayoutDashboard,
  FolderOpen,
  Share2,
  Clock,
  Activity,
  Box,
  Users,
  MessageSquareText,
  FileText,
  ShieldCheck,
  ClipboardCheck,
  Map as MapIcon,
  type LucideIcon
} from 'lucide-react';

/** The workspace modules, one per tab: /cases/:caseId/:module. */
export type CaseModule =
  | 'overview'
  | 'evidence'
  | 'people'
  | 'review'
  | 'canvas'
  | 'timeline'
  | 'reconstruction'
  | 'area'
  | 'autopsy'
  | 'copilot'
  | 'reports'
  | 'settings';

/** Sidebar groups follow the investigation: record the case, analyse it, then report on it. */
export type CaseModuleGroup = 'record' | 'analyse' | 'report';

export const CASE_MODULE_GROUPS: { id: CaseModuleGroup; label: string }[] = [
  { id: 'record', label: 'Case record' },
  { id: 'analyse', label: 'Analysis' },
  { id: 'report', label: 'Output' }
];

export interface CaseModuleInfo {
  id: CaseModule;
  label: string;
  icon: LucideIcon;
  group: CaseModuleGroup;
  /** Reachable by URL but left out of the sidebar. */
  hidden?: boolean;
}

// Order is the order of the workspace sidebar.
export const CASE_MODULES: CaseModuleInfo[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, group: 'record' },
  { id: 'evidence', label: 'Evidence', icon: FolderOpen, group: 'record' },
  { id: 'people', label: 'People & vehicles', icon: Users, group: 'record' },
  { id: 'review', label: 'AI review', icon: ClipboardCheck, group: 'analyse' },
  { id: 'canvas', label: 'Canvas', icon: Share2, group: 'analyse' },
  { id: 'timeline', label: 'Timeline', icon: Clock, group: 'analyse' },
  { id: 'reconstruction', label: 'Reconstruction', icon: Box, group: 'analyse' },
  // CesiumJS area model with building selection and dissection.
  { id: 'area', label: 'Area & buildings', icon: MapIcon, group: 'analyse' },
  { id: 'copilot', label: 'Ask the evidence', icon: MessageSquareText, group: 'analyse' },
  { id: 'reports', label: 'Reports', icon: FileText, group: 'report' },
  { id: 'settings', label: 'Custody & audit', icon: ShieldCheck, group: 'report' },
  // Medical findings and segmented reference anatomy.
  { id: 'autopsy', label: 'Autopsy & medical', icon: Activity, group: 'analyse' }
];

export const isCaseModule = (value: string | undefined): value is CaseModule =>
  CASE_MODULES.some((m) => m.id === value);

export const caseModuleLabel = (module: CaseModule) =>
  CASE_MODULES.find((m) => m.id === module)?.label ?? 'Overview';

export const casePath = (caseId: string | number, module: CaseModule = 'overview') =>
  module === 'overview' ? `/cases/${caseId}` : `/cases/${caseId}/${module}`;

/** Case IDs are integers; any other value in the URL names no case. */
export const parseCaseId = (value: string | undefined): number | null =>
  value !== undefined && /^\d+$/.test(value) ? Number(value) : null;
