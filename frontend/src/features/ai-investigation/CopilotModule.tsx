import React, { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Tabs } from '@/components/shared/Segmented';
import { Id } from '@/types/api';
import { AskPanel } from './AskPanel';
import { PassageSearch } from './PassageSearch';

/** Questions answered from cited passages, and plain passage search for checking them. */
export const CopilotModule: React.FC<{ caseId: Id }> = ({ caseId }) => {
  const [tab, setTab] = useState<'ask' | 'search'>('ask');

  return (
    <div className="space-y-4 max-w-4xl">
      <PageHeader
        title="Ask the evidence"
        description="Answers are drawn only from this case's evidence. Check each cited passage before relying on it."
      />
      <Tabs
        label="Ask or search"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'ask', label: 'Ask a question' },
          { value: 'search', label: 'Search passages' }
        ]}
      />
      {tab === 'ask' ? <AskPanel caseId={caseId} /> : <PassageSearch caseId={caseId} />}
    </div>
  );
};
