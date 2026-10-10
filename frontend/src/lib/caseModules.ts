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
  Settings
} from 'lucide-react';
import type { ElementType } from 'react';
import { CaseModule } from '@/types';

export interface CaseModuleInfo {
  id: CaseModule;
  label: string;
  icon: ElementType;
}

// Order is the order of the workspace sidebar.
export const CASE_MODULES: CaseModuleInfo[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'evidence', label: 'Evidence Locker', icon: FolderKanban },
  { id: 'canvas', label: 'Investigation Canvas', icon: Share2 },
  { id: 'timeline', label: 'Timeline Chronology', icon: Clock },
  { id: 'autopsy', label: 'Autopsy & Medical', icon: Activity },
  { id: 'crimescene', label: 'Crime Scene Spatial', icon: Box },
  { id: 'witnesses', label: 'Witnesses & POIs', icon: Users },
  { id: 'copilot', label: 'AI Copilot', icon: Bot },
  { id: 'reports', label: 'Dossier Reports', icon: FileSpreadsheet },
  { id: 'settings', label: 'Case Settings', icon: Settings }
];

export const isCaseModule = (value: string | undefined): value is CaseModule =>
  CASE_MODULES.some((m) => m.id === value);

export const caseModuleLabel = (module: CaseModule) =>
  CASE_MODULES.find((m) => m.id === module)?.label ?? 'Overview';

export const casePath = (caseId: string, module: CaseModule = 'overview') =>
  module === 'overview' ? `/cases/${caseId}` : `/cases/${caseId}/${module}`;
