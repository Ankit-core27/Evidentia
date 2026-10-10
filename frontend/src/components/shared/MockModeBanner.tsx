import React from 'react';
import { FlaskConical } from 'lucide-react';
import { isMockMode } from '@/lib/api';

/** Shown in `npm run dev:mock`, so nobody mistakes mock data for the real backend. */
export const MockModeBanner: React.FC = () => {
  if (!isMockMode) return null;
  return (
    <div className="fixed bottom-3 right-3 z-50 px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[10px] font-mono font-bold flex items-center gap-1.5 shadow-lg pointer-events-none">
      <FlaskConical className="w-3.5 h-3.5" />
      MOCK BACKEND: DATA RESETS ON RELOAD
    </div>
  );
};
