import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAppContext } from './AppLayout';

// Wrapper for the agency-level pages (dashboard, cases, evidence, reports).
export const MacroLayout: React.FC = () => {
  const context = useAppContext();

  return (
    <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 lg:px-6 pt-6 pb-12">
      <Outlet context={context} />
    </main>
  );
};
