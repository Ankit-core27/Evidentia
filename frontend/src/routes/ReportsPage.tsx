import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppContext } from '@/components/layout/AppLayout';
import { ReportsGeneratorView } from '@/features/reports/ReportsGeneratorView';

// Intelligence Hub. /reports?case=<id> preselects a case.
export const ReportsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { cases } = useAppContext();

  return (
    <ReportsGeneratorView
      cases={cases}
      selectedCaseIdForReport={searchParams.get('case') ?? cases[0]?.id}
    />
  );
};
