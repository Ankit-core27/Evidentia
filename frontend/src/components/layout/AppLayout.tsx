import React, { useState } from 'react';
import { Outlet, ScrollRestoration, useMatch, useOutletContext } from 'react-router-dom';
import { Header } from './Header';
import { CreateCaseModal } from '@/components/cases/CreateCaseModal';
import { EvidencePreviewModal } from '@/components/evidence/EvidencePreviewModal';
import { MockModeBanner } from '@/components/shared/MockModeBanner';
import { mockCases } from '@/data/mockData';
import { isCaseModule } from '@/lib/caseModules';
import { ForensicCase, EvidenceItem, CaseStatus } from '@/types';

// Shared app state handed to every page through the router outlet.
// `cases` holds the UI draft's mock cases, still used by the dashboard, global
// evidence and reports pages until they read from the API.
export interface AppOutletContext {
  cases: ForensicCase[];
  updateCaseStatus: (caseId: string, newStatus: CaseStatus) => void;
  openCreateCaseModal: () => void;
  previewEvidence: (item: EvidenceItem) => void;
}

export const useAppContext = () => useOutletContext<AppOutletContext>();

export const AppLayout: React.FC = () => {
  const workspaceMatch = useMatch('/cases/:caseId/:module?');

  const [cases, setCases] = useState<ForensicCase[]>(mockCases);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [previewEvidence, setPreviewEvidence] = useState<EvidenceItem | null>(null);

  const moduleParam = workspaceMatch?.params.module;
  const activeModule = isCaseModule(moduleParam) ? moduleParam : 'overview';

  const context: AppOutletContext = {
    cases,
    updateCaseStatus: (caseId, newStatus) =>
      setCases((prevCases) =>
        prevCases.map((c) => (c.id === caseId ? { ...c, status: newStatus } : c))
      ),
    openCreateCaseModal: () => setIsCreateModalOpen(true),
    previewEvidence: (item) => setPreviewEvidence(item)
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-cyan-500 selection:text-slate-950 bg-[radial-gradient(circle_at_top_right,_#0f172a,_#020617)] flex flex-col">
      <ScrollRestoration />

      {/* Top Navigation Header (Macro Tabs or Workspace Breadcrumbs) */}
      <Header activeModule={activeModule} onOpenCreateModal={() => setIsCreateModalOpen(true)} />

      {/* Main Body Layout */}
      <div className="flex-1 flex flex-col">
        <Outlet context={context} />
      </div>

      {/* "+ Create Case" Pop-up Modal */}
      <CreateCaseModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />

      {/* Evidence Preview Modal */}
      <EvidencePreviewModal
        evidence={previewEvidence}
        onClose={() => setPreviewEvidence(null)}
      />

      <MockModeBanner />
    </div>
  );
};
