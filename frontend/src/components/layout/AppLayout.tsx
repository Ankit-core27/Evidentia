import React, { useState } from 'react';
import { Outlet, ScrollRestoration, useMatch, useOutletContext } from 'react-router-dom';
import { Header } from './Header';
import { CreateCaseModal } from '@/components/cases/CreateCaseModal';
import { EvidenceInspector } from '@/components/evidence/EvidenceInspector';
import { MockModeBanner } from '@/components/shared/MockModeBanner';
import { isCaseModule } from '@/lib/caseModules';

// Shared app actions handed to every page through the router outlet. Data comes
// from the API through the hooks in src/hooks.
export interface AppOutletContext {
  openCreateCaseModal: () => void;
}

export const useAppContext = () => useOutletContext<AppOutletContext>();

export const AppLayout: React.FC = () => {
  const workspaceMatch = useMatch('/cases/:caseId/:module?');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);

  const moduleParam = workspaceMatch?.params.module;
  const activeModule = isCaseModule(moduleParam) ? moduleParam : 'overview';

  const context: AppOutletContext = {
    openCreateCaseModal: () => setIsCreateModalOpen(true)
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

      {/* Evidence inspector, opened by ?evidence=<id> from anywhere */}
      <EvidenceInspector />

      <MockModeBanner />
    </div>
  );
};
