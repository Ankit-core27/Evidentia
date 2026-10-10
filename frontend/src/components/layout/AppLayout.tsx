import React, { useState } from 'react';
import { Outlet, ScrollRestoration, useMatch, useOutletContext } from 'react-router-dom';
import { Header } from './Header';
import { CreateCaseModal } from '@/components/cases/CreateCaseModal';
import { EvidenceInspector } from '@/components/evidence/EvidenceInspector';
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
    <div className="relative isolate min-h-screen text-ink flex flex-col">
      <ScrollRestoration />

      {/* Animated backdrop behind every page (served from the repo-root assets/ folder). */}
      <img
        src="/backgrounds/forensic-evidence-loop.svg"
        alt=""
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 size-full object-cover"
      />

      {/* Agency navigation, or the case breadcrumb inside a workspace */}
      <Header activeModule={activeModule} onOpenCreateModal={() => setIsCreateModalOpen(true)} />

      <div className="flex-1 flex flex-col">
        <Outlet context={context} />
      </div>

      <CreateCaseModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />

      {/* Evidence inspector, opened by ?evidence=<id> from anywhere */}
      <EvidenceInspector />
    </div>
  );
};
