import React, { useState } from 'react';
import { Outlet, ScrollRestoration, useMatch, useNavigate, useOutletContext } from 'react-router-dom';
import { Header } from './Header';
import { CreateCaseModal } from '@/components/cases/CreateCaseModal';
import { EvidencePreviewModal } from '@/components/evidence/EvidencePreviewModal';
import { MockModeBanner } from '@/components/shared/MockModeBanner';
import { mockCases, mockInvestigators, mockSystemAlerts } from '@/data/mockData';
import { isCaseModule, casePath } from '@/lib/caseModules';
import { ForensicCase, EvidenceItem, CaseStatus } from '@/types';

// Shared app state handed to every page through the router outlet.
// The mock cases live here until the pages read from the API.
export interface AppOutletContext {
  cases: ForensicCase[];
  updateCaseStatus: (caseId: string, newStatus: CaseStatus) => void;
  openCreateCaseModal: () => void;
  previewEvidence: (item: EvidenceItem) => void;
}

export const useAppContext = () => useOutletContext<AppOutletContext>();

export const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const workspaceMatch = useMatch('/cases/:caseId/:module?');

  const [cases, setCases] = useState<ForensicCase[]>(mockCases);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [previewEvidence, setPreviewEvidence] = useState<EvidenceItem | null>(null);

  const activeCase = cases.find((c) => c.id === workspaceMatch?.params.caseId) || null;
  const moduleParam = workspaceMatch?.params.module;
  const activeModule = isCaseModule(moduleParam) ? moduleParam : 'overview';

  const handleCreateCase = (newCase: ForensicCase) => {
    setCases((prevCases) => [newCase, ...prevCases]);
    navigate(casePath(newCase.id));
  };

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
      <Header
        activeCase={activeCase}
        activeModule={activeModule}
        searchTerm={searchTerm}
        onSearchChange={(term) => setSearchTerm(term)}
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
        alerts={mockSystemAlerts}
        allCases={cases}
      />

      {/* Main Body Layout */}
      <div className="flex-1 flex flex-col">
        <Outlet context={context} />
      </div>

      {/* "+ Create Case" Pop-up Modal */}
      <CreateCaseModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        investigators={mockInvestigators}
        onCreateCase={handleCreateCase}
      />

      {/* Evidence Preview Modal */}
      <EvidencePreviewModal
        evidence={previewEvidence}
        onClose={() => setPreviewEvidence(null)}
      />

      <MockModeBanner />
    </div>
  );
};
