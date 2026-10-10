import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CasesIndexView } from '@/components/cases/CasesIndexView';
import { useAppContext } from '@/components/layout/AppLayout';
import { casePath } from '@/lib/caseModules';

export const CasesPage: React.FC = () => {
  const navigate = useNavigate();
  const { openCreateCaseModal } = useAppContext();

  return (
    <CasesIndexView
      onSelectCase={(id) => navigate(casePath(id))}
      onOpenCreateModal={openCreateCaseModal}
      onNavigateToReports={(id) => navigate(casePath(id, 'reports'))}
    />
  );
};
