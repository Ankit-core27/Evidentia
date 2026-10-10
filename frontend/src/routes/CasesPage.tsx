import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CasesIndexView } from '@/components/cases/CasesIndexView';
import { useAppContext } from '@/components/layout/AppLayout';
import { casePath } from '@/lib/caseModules';

export const CasesPage: React.FC = () => {
  const navigate = useNavigate();
  const { cases, openCreateCaseModal } = useAppContext();

  return (
    <CasesIndexView
      cases={cases}
      onSelectCase={(id) => navigate(casePath(id))}
      onOpenCreateModal={openCreateCaseModal}
      onNavigateToReports={(caseId) => navigate(caseId ? casePath(caseId, 'reports') : '/reports')}
    />
  );
};
