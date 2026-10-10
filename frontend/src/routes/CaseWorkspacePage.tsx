import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { CaseWorkspaceSidebar } from '@/components/layout/CaseWorkspaceSidebar';
import { NotWiredYet } from '@/components/shared/NotWiredYet';
import { ErrorState, LoadingState } from '@/components/shared/QueryState';
import { CaseSummary } from '@/features/case-management/CaseSummary';
import { CaseWorkspaceBanner } from '@/features/case-management/CaseWorkspaceBanner';
import { PeopleModule } from '@/features/case-management/PeopleModule';
import { SettingsModule } from '@/features/case-management/SettingsModule';
import { EvidenceModule } from '@/features/evidence-management/EvidenceModule';
import { CaseCanvasModule } from '@/features/evidence-canvas/CaseCanvasModule';
import { IncidentTimeline } from '@/features/incident-timeline/IncidentTimeline';
import { ReconstructionModule } from '@/features/reconstruction/ReconstructionModule';
import { CopilotModule } from '@/features/ai-investigation/CopilotModule';
import { ReviewModule } from '@/features/ai-investigation/ReviewModule';
import { CaseReportsModule } from '@/features/reports/CaseReportsModule';
import { useCaseWorkspace } from '@/hooks/useCases';
import { ApiError } from '@/lib/api';
import { CaseModule, caseModuleLabel, casePath, isCaseModule, parseCaseId } from '@/lib/caseModules';
import { NotFoundPage } from './NotFoundPage';

// /cases/:caseId/:module? — one tab per feature module.
export const CaseWorkspacePage: React.FC = () => {
  const { caseId, module } = useParams();

  if (module !== undefined && !isCaseModule(module)) {
    return <Navigate to={casePath(caseId!)} replace />;
  }
  const activeModule: CaseModule = isCaseModule(module) ? module : 'overview';

  const id = parseCaseId(caseId);
  if (id === null) return <CaseNotFound caseId={caseId} />;
  return <CaseWorkspace key={id} caseId={id} activeModule={activeModule} />;
};

const CaseNotFound: React.FC<{ caseId: string | undefined }> = ({ caseId }) => (
  <main className="flex-1 pb-12">
    <NotFoundPage title="Case not found" message={`No case with ID ${caseId} exists.`} />
  </main>
);

/** Which task in docs/FRONTEND_TASKS.md wires each module to the API. */
const PENDING_MODULES: Partial<Record<CaseModule, string>> = {
  autopsy: 'T13'
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
        {activeModule === 'timeline' && <IncidentTimeline workspace={workspace} />}
        {activeModule === 'reconstruction' && <ReconstructionModule workspace={workspace} />}
        {activeModule === 'copilot' && <CopilotModule caseId={c.id} />}
        {activeModule === 'reports' && <CaseReportsModule caseId={c.id} />}
        {activeModule === 'settings' && <SettingsModule workspace={workspace} />}
        {pendingTask && <NotWiredYet module={caseModuleLabel(activeModule)} task={pendingTask} />}
      </main>
    </div>
  );
};
