import React from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { CaseWorkspace } from '@/types/api';
import { EvidenceCanvas } from './EvidenceCanvas';

/** The Investigation Canvas module of a case workspace. */
export const CaseCanvasModule: React.FC<{ workspace: CaseWorkspace }> = ({ workspace }) => (
  <div className="space-y-4">
    <PageHeader
      title="Investigation canvas"
      description="People, vehicles, places and evidence, and how they connect. Dashed links are AI proposals until confirmed."
    />
    <EvidenceCanvas workspace={workspace} />
  </div>
);
