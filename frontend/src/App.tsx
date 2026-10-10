import React, { useState } from 'react';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { CasesIndexView } from './components/CasesIndexView';
import { CaseWorkspace } from './components/CaseWorkspace';
import { EvidenceLockerView } from './components/EvidenceLockerView';
import { ReportsGeneratorView } from './components/ReportsGeneratorView';
import { CreateCaseModal } from './components/CreateCaseModal';
import { EvidencePreviewModal } from './components/EvidencePreviewModal';

import {
  mockCases,
  mockInvestigators,
  mockMapIncidents,
  mockSystemAlerts,
  mockGlobalEvidence
} from './data/mockData';
import { ForensicCase, EvidenceItem, CaseStatus, CaseModule } from './types';

export default function App() {
  const [macroView, setMacroView] = useState<'dashboard' | 'cases' | 'evidence' | 'reports'>('dashboard');
  const [cases, setCases] = useState<ForensicCase[]>(mockCases);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<CaseModule>('overview');

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [previewEvidence, setPreviewEvidence] = useState<EvidenceItem | null>(null);

  const activeCase = cases.find((c) => c.id === activeCaseId) || null;

  // Navigating to an individual Case Workspace
  const handleSelectCase = (caseId: string, initialModule: CaseModule = 'overview') => {
    setActiveCaseId(caseId);
    setActiveModule(initialModule);
  };

  // Exiting Case Workspace back to Macro View
  const handleExitCaseWorkspace = () => {
    setActiveCaseId(null);
  };

  // Handle New Case Creation
  const handleCreateCase = (newCase: ForensicCase) => {
    setCases([newCase, ...cases]);
    setActiveCaseId(newCase.id);
    setActiveModule('overview');
  };

  const handleUpdateCaseStatus = (caseId: string, newStatus: CaseStatus) => {
    setCases((prevCases) =>
      prevCases.map((c) => (c.id === caseId ? { ...c, status: newStatus } : c))
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-cyan-500 selection:text-slate-950 bg-[radial-gradient(circle_at_top_right,_#0f172a,_#020617)] flex flex-col">
      {/* Top Navigation Header (Macro Tabs or Workspace Breadcrumbs) */}
      <Header
        macroView={macroView}
        onMacroViewChange={(view) => {
          setMacroView(view);
          setActiveCaseId(null);
        }}
        activeCase={activeCase}
        activeModule={activeModule}
        onExitCaseWorkspace={handleExitCaseWorkspace}
        searchTerm={searchTerm}
        onSearchChange={(term) => setSearchTerm(term)}
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
        alerts={mockSystemAlerts}
        allCases={cases}
        onSelectCase={(id) => handleSelectCase(id)}
      />

      {/* Main Body Layout */}
      <div className="flex-1 flex flex-col">
        {activeCase ? (
          /* Dedicated Case Workspace (Sidebar + Module Panel) */
          <CaseWorkspace
            forensicCase={activeCase}
            activeModule={activeModule}
            onSelectModule={(mod) => setActiveModule(mod)}
            onExitWorkspace={handleExitCaseWorkspace}
            onPreviewEvidence={(item) => setPreviewEvidence(item)}
            onUpdateStatus={handleUpdateCaseStatus}
          />
        ) : (
          /* Macro Agency Level Views */
          <main className="flex-1 pb-12">
            {macroView === 'dashboard' && (
              <DashboardView
                cases={cases}
                mapPoints={mockMapIncidents}
                alerts={mockSystemAlerts}
                investigators={mockInvestigators}
                onSelectCase={(id) => handleSelectCase(id)}
                onOpenCreateModal={() => setIsCreateModalOpen(true)}
              />
            )}

            {macroView === 'cases' && (
              <CasesIndexView
                cases={cases}
                onSelectCase={(id) => handleSelectCase(id)}
                onOpenCreateModal={() => setIsCreateModalOpen(true)}
                onNavigateToReports={(caseId) => {
                  if (caseId) handleSelectCase(caseId, 'reports');
                  else setMacroView('reports');
                }}
              />
            )}

            {macroView === 'evidence' && (
              <EvidenceLockerView
                evidenceList={mockGlobalEvidence}
                onPreviewEvidence={(item) => setPreviewEvidence(item)}
                onSelectCase={(id) => handleSelectCase(id)}
              />
            )}

            {macroView === 'reports' && (
              <ReportsGeneratorView
                cases={cases}
                selectedCaseIdForReport={activeCaseId || cases[0]?.id}
              />
            )}
          </main>
        )}
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
    </div>
  );
}

