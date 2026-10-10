import {
  LayoutDashboard,
  FolderKanban,
  Share2,
  Clock,
  Activity,
  Box,
  Users,
  Bot,
  FileSpreadsheet,
  Settings,
  ClipboardCheck
} from 'lucide-react';
import type { ElementType } from 'react';
import { CaseModule } from '@/types';

export interface CaseModuleInfo {
  id: CaseModule;
  label: string;
  icon: ElementType;
  /** Reachable by URL but left out of the sidebar. */
  hidden?: boolean;
}

// Order is the order of the workspace sidebar.
export const CASE_MODULES: CaseModuleInfo[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'evidence', label: 'Evidence', icon: FolderKanban },
  { id: 'people', label: 'People & Vehicles', icon: Users },
  { id: 'review', label: 'AI Review', icon: ClipboardCheck },
  { id: 'canvas', label: 'Investigation Canvas', icon: Share2 },
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'reconstruction', label: 'Reconstruction', icon: Box },
  { id: 'copilot', label: 'AI Copilot', icon: Bot },
  { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
  { id: 'settings', label: 'Case Settings', icon: Settings },
  // The 2D anatomy draft stays until the 3D anatomy explorer (M5, T13).
  { id: 'autopsy', label: 'Autopsy & Medical', icon: Activity, hidden: true }
];

export const isCaseModule = (value: string | undefined): value is CaseModule =>
  CASE_MODULES.some((m) => m.id === value);

export const caseModuleLabel = (module: CaseModule) =>
  CASE_MODULES.find((m) => m.id === module)?.label ?? 'Overview';

export const casePath = (caseId: string | number, module: CaseModule = 'overview') =>
  module === 'overview' ? `/cases/${caseId}` : `/cases/${caseId}/${module}`;

/** Case IDs from the API are integers; anything else is a case from the UI draft's mock data. */
export const parseCaseId = (value: string | undefined): number | null =>
  value !== undefined && /^\d+$/.test(value) ? Number(value) : null;
