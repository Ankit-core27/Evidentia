import React from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { CaseWorkspaceSidebar } from '@/components/layout/CaseWorkspaceSidebar';
import { useAppContext } from '@/components/layout/AppLayout';
import { NotWiredYet } from '@/components/shared/NotWiredYet';
import { ErrorState, LoadingState } from '@/components/shared/QueryState';
import { CaseBanner } from '@/features/case-management/CaseBanner';
import { CaseOverview } from '@/features/case-management/CaseOverview';
import { CaseSummary } from '@/features/case-management/CaseSummary';
import { CaseWorkspaceBanner } from '@/features/case-management/CaseWorkspaceBanner';
import { PeopleModule } from '@/features/case-management/PeopleModule';
import { PersonsModule } from '@/features/case-management/PersonsModule';
import { CaseSettings } from '@/features/case-management/CaseSettings';
import { SettingsModule } from '@/features/case-management/SettingsModule';
import { EvidenceModule } from '@/features/evidence-management/EvidenceModule';
import { CaseEvidenceModule } from '@/features/evidence-management/CaseEvidenceModule';
import { CanvasModule } from '@/features/evidence-canvas/CanvasModule';
import { CaseCanvasModule } from '@/features/evidence-canvas/CaseCanvasModule';
import { TimelineModule } from '@/features/incident-timeline/TimelineModule';
import { AutopsyModule } from '@/features/anatomy/AutopsyModule';
import { CrimeSceneModule } from '@/features/reconstruction/CrimeSceneModule';
import { CopilotModule } from '@/features/ai-investigation/CopilotModule';
import { ReviewModule } from '@/features/ai-investigation/ReviewModule';
import { CopilotPanel } from '@/features/ai-investigation/CopilotPanel';
import { useMockCopilot } from '@/features/ai-investigation/useMockCopilot';
import { CaseReportModule } from '@/features/reports/CaseReportModule';
import { useCaseWorkspace } from '@/hooks/useCases';
import { ApiError } from '@/lib/api';
import { caseModuleLabel, casePath, isCaseModule, parseCaseId } from '@/lib/caseModules';
import { CaseModule, ForensicCase } from '@/types';
import { NotFoundPage } from './NotFoundPage';

// /cases/:caseId/:module? — one tab per feature module.
export const CaseWorkspacePage: React.FC = () => {
  const { caseId, module } = useParams();
  const { cases } = useAppContext();

  if (module !== undefined && !isCaseModule(module)) {
    return <Navigate to={casePath(caseId!)} replace />;
  }
  const activeModule: CaseModule = isCaseModule(module) ? module : 'overview';

  const apiCaseId = parseCaseId(caseId);
  if (apiCaseId !== null) {
    return <CaseWorkspace key={apiCaseId} caseId={apiCaseId} activeModule={activeModule} />;
  }

  // Cases from the UI draft's mock data, still linked from the dashboard and global
  // evidence pages until those read from the API (T5, T12).
  const draftCase = cases.find((c) => c.id === caseId);
  if (draftCase) {
    return <DraftCaseWorkspace key={draftCase.id} forensicCase={draftCase} activeModule={activeModule} />;
  }

  return <CaseNotFound caseId={caseId} />;
};

const CaseNotFound: React.FC<{ caseId: string | undefined }> = ({ caseId }) => (
  <main className="flex-1 pb-12">
    <NotFoundPage title="Case not found" message={`No case with ID ${caseId} exists.`} />
  </main>
);

/** Which task in docs/FRONTEND_TASKS.md wires each module to the API. */
const PENDING_MODULES: Partial<Record<CaseModule, string>> = {
  timeline: 'T9',
  reconstruction: 'T10',
  autopsy: 'T13',
  reports: 'T11'
};

const kept = <T extends { review_status: string }>(rows: T[]) => rows.filter((r) => r.review_status !== 'rejected');

const CaseWorkspace: React.FC<{ caseId: number; activeModule: CaseModule }> = ({ caseId, activeModule }) => {
  const workspaceQuery = useCaseWorkspace(caseId);

  if (workspaceQuery.isError && workspaceQuery.error instanceof ApiError && workspaceQuery.error.status === 404) {
    return <CaseNotFound caseId={String(caseId)} />;
  }
  if (!workspaceQuery.data) {
    return (
      <main className="flex-1 p-6">
        {workspaceQuery.isError ? (
          <ErrorState error={workspaceQuery.error} onRetry={() => workspaceQuery.refetch()} />
        ) : (
          <LoadingState label="Loading case…" />
        )}
      </main>
    );
  }

  const workspace = workspaceQuery.data;
  const c = workspace.case;
  const pendingTask = PENDING_MODULES[activeModule];

  return (
    <div className="flex flex-1 min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 font-mono">
      <CaseWorkspaceSidebar
        caseId={c.id}
        caseNumber={c.case_number}
        title={c.title}
        priority={c.priority}
        activeModule={activeModule}
        badges={{
          evidence: workspace.counts.evidence,
          people: kept(workspace.persons).length + kept(workspace.objects).length,
          review: workspace.counts.pending_reviews + workspace.counts.open_conflicts || undefined,
          timeline: kept(workspace.events).length,
          copilot: 'AI'
        }}
      />

      <main className="flex-1 p-4 lg:p-6 overflow-y-auto space-y-6 min-w-0">
        <CaseWorkspaceBanner workspace={workspace} />
        {activeModule === 'overview' && <CaseSummary workspace={workspace} />}
        {activeModule === 'evidence' && <EvidenceModule caseId={c.id} />}
        {activeModule === 'people' && <PeopleModule workspace={workspace} />}
        {activeModule === 'review' && <ReviewModule workspace={workspace} />}
        {activeModule === 'canvas' && <CaseCanvasModule workspace={workspace} />}
        {activeModule === 'copilot' && <CopilotModule caseId={c.id} />}
        {activeModule === 'settings' && <SettingsModule caseId={c.id} />}
        {pendingTask && <NotWiredYet module={caseModuleLabel(activeModule)} task={pendingTask} />}
      </main>
    </div>
  );
};

interface DraftCaseWorkspaceProps {
  forensicCase: ForensicCase;
  activeModule: CaseModule;
}

/** The UI draft's workspace over its mock data. Removed once no screen links to draft cases. */
const DraftCaseWorkspace: React.FC<DraftCaseWorkspaceProps> = ({ forensicCase, activeModule }) => {
  const navigate = useNavigate();
  const { updateCaseStatus, previewEvidence } = useAppContext();
  const copilot = useMockCopilot(forensicCase);

  const selectModule = (target: CaseModule) => navigate(casePath(forensicCase.id, target));

  return (
    <div className="flex flex-1 min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 font-mono">
      <CaseWorkspaceSidebar
        caseId={forensicCase.id}
        caseNumber={forensicCase.id}
        title={forensicCase.title}
        priority={forensicCase.priority}
        activeModule={activeModule}
        badges={{
          evidence: forensicCase.evidenceList.length || forensicCase.evidenceCount,
          timeline: forensicCase.timeline.length,
          people: forensicCase.personsOfInterest.length,
          copilot: 'AI'
        }}
      />

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
        {activeModule === 'reconstruction' && <CrimeSceneModule />}
        {activeModule === 'people' && <PersonsModule forensicCase={forensicCase} />}
        {activeModule === 'review' && <NotWiredYet module="AI Review" task="T7" />}
        {activeModule === 'copilot' && <CopilotPanel messages={copilot.messages} onSend={copilot.send} />}
        {activeModule === 'reports' && <CaseReportModule forensicCase={forensicCase} />}
        {activeModule === 'settings' && <CaseSettings />}
      </main>
    </div>
  );
};
