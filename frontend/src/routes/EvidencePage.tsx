import React from 'react';
import { useNavigate } from 'react-router-dom';
import { EvidenceLockerView } from '@/components/evidence/EvidenceLockerView';
import { useAppContext } from '@/components/layout/AppLayout';
import { mockGlobalEvidence } from '@/data/mockData';
import { casePath } from '@/lib/caseModules';

export const EvidencePage: React.FC = () => {
  const navigate = useNavigate();
  const { previewEvidence } = useAppContext();

  return (
    <EvidenceLockerView
      evidenceList={mockGlobalEvidence}
      onPreviewEvidence={previewEvidence}
      onSelectCase={(id) => navigate(casePath(id))}
    />
  );
};
