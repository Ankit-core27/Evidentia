import React from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { CaseWorkspaceSidebar } from '@/components/layout/CaseWorkspaceSidebar';
import { useAppContext } from '@/components/layout/AppLayout';
import { CaseBanner } from '@/features/case-management/CaseBanner';
import { CaseOverview } from '@/features/case-management/CaseOverview';
import { PersonsModule } from '@/features/case-management/PersonsModule';
import { CaseSettings } from '@/features/case-management/CaseSettings';
import { CaseEvidenceModule } from '@/features/evidence-management/CaseEvidenceModule';
import { CanvasModule } from '@/features/evidence-canvas/CanvasModule';
import { TimelineModule } from '@/features/incident-timeline/TimelineModule';
import { AutopsyModule } from '@/features/anatomy/AutopsyModule';
import { CrimeSceneModule } from '@/features/reconstruction/CrimeSceneModule';
import { CopilotPanel } from '@/features/ai-investigation/CopilotPanel';
import { useMockCopilot } from '@/features/ai-investigation/useMockCopilot';
import { CaseReportModule } from '@/features/reports/CaseReportModule';
import { casePath, isCaseModule } from '@/lib/caseModules';
import { CaseModule, ForensicCase } from '@/types';
import { NotFoundPage } from './NotFoundPage';

// /cases/:caseId/:module? — one tab per feature module.
export const CaseWorkspacePage: React.FC = () => {
  const { caseId, module } = useParams();
  const { cases } = useAppContext();
  const forensicCase = cases.find((c) => c.id === caseId);

  if (!forensicCase) {
    return (
      <main className="flex-1 pb-12">
        <NotFoundPage title="Case not found" message={`No case with ID ${caseId} exists.`} />
      </main>
    );
  }

  if (module !== undefined && !isCaseModule(module)) {
    return <Navigate to={casePath(forensicCase.id)} replace />;
  }

  // Keyed by case so per-case state (such as the copilot conversation) resets when switching cases.
  return <CaseWorkspace key={forensicCase.id} forensicCase={forensicCase} activeModule={module ?? 'overview'} />;
};

interface CaseWorkspaceProps {
  forensicCase: ForensicCase;
  activeModule: CaseModule;
}

const CaseWorkspace: React.FC<CaseWorkspaceProps> = ({ forensicCase, activeModule }) => {
  const navigate = useNavigate();
  const { updateCaseStatus, previewEvidence } = useAppContext();
  const copilot = useMockCopilot(forensicCase);

  const selectModule = (target: CaseModule) => navigate(casePath(forensicCase.id, target));

  return (
    <div className="flex flex-1 min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 font-mono">
      {/* 1. Case Workspace Secondary Left Sidebar */}
      <CaseWorkspaceSidebar activeCase={forensicCase} activeModule={activeModule} />

      {/* 2. Main Case Module Panel Content */}
      <main className="flex-1 p-4 lg:p-6 overflow-y-auto space-y-6">
        <CaseBanner forensicCase={forensicCase} onUpdateStatus={updateCaseStatus} />

        {activeModule === 'overview' && (
          <CaseOverview
            forensicCase={forensicCase}
            onSelectModule={selectModule}
            onPreviewEvidence={previewEvidence}
            onAskCopilot={copilot.send}
          />
        )}
        {activeModule === 'evidence' && (
          <CaseEvidenceModule forensicCase={forensicCase} onPreviewEvidence={previewEvidence} />
        )}
        {activeModule === 'canvas' && <CanvasModule forensicCase={forensicCase} />}
        {activeModule === 'timeline' && <TimelineModule forensicCase={forensicCase} />}
        {activeModule === 'autopsy' && <AutopsyModule forensicCase={forensicCase} />}
        {activeModule === 'crimescene' && <CrimeSceneModule />}
        {activeModule === 'witnesses' && <PersonsModule forensicCase={forensicCase} />}
        {activeModule === 'copilot' && <CopilotPanel messages={copilot.messages} onSend={copilot.send} />}
        {activeModule === 'reports' && <CaseReportModule forensicCase={forensicCase} />}
        {activeModule === 'settings' && <CaseSettings />}
      </main>
    </div>
  );
};
