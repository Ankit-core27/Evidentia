import { useState } from 'react';
import { ForensicCase, CopilotMessage } from '@/types';

// Canned replies from the UI draft, until POST /api/cases/{id}/ask is wired (T6).
export const useMockCopilot = (forensicCase: ForensicCase) => {
  // Copilot State
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([
    {
      id: 'MSG-1',
      sender: 'copilot',
      timestamp: '22:46 PST',
      text: `Hello Det. A. Sharma. I have finished cross-referencing all 14 evidence files for ${forensicCase.id} (${forensicCase.title}).`,
      citations: ['EVD-8801-01 (Autopsy)', 'EVD-8801-02 (DNA Swab #B-42)', 'EVD-8801-03 (Cell Tower #409)'],
      suggestedActions: [
        'Analyze Victor Vance alibi contradiction',
        'Inspect VX-7B toxin synthesis records from Apex Bio-Labs',
        'Review CCTV facial biometric match from service elevator'
      ]
    }
  ]);

  const send = (query: string) => {
    if (!query.trim()) return;

    const userMsg: CopilotMessage = {
      id: `USER-${Date.now()}`,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: query
    };

    setCopilotMessages((prev) => [...prev, userMsg]);

    setTimeout(() => {
      let aiResponseText = `AI Forensic Copilot Analysis for case ${forensicCase.id}:\n\n` +
        `Based on spectral analysis and CODIS database query, victim ${forensicCase.victim?.name || 'Julian Vance'} suffered fatal respiratory paralysis caused by VX-7B neurotoxin. ` +
        `Touch DNA recovered from Swab #B-42 matches prime suspect Victor Vance with 99.98% probability. ` +
        `Additionally, cell tower #409 logs place Victor Vance's handset 120m from the crime scene at 22:42 PST, disproving his stated airport alibi.`;

      if (query.toLowerCase().includes('victim')) {
        aiResponseText = `Victim Dossier Query:\nName: ${forensicCase.victim?.name || 'Julian Vance'} (Age ${forensicCase.victim?.age || 48})\n` +
          `Status: ${forensicCase.victim?.status || 'Deceased - Confirmed'}\n` +
          `Cause of Death: ${forensicCase.victim?.causeOfDeath || 'Synthetic VX-7B Neurotoxin'}\n` +
          `DNA Verification: ${forensicCase.victim?.dnaMatchVerification || '99.98% CODIS Match'}\n\n` +
          `Key Finding: Micro-puncture mark found adjacent to right carotid artery. Subjugation occurred rapidly within 45 seconds.`;
      }

      const copilotResponse: CopilotMessage = {
        id: `COPILOT-${Date.now()}`,
        sender: 'copilot',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: aiResponseText,
        citations: ['EVD-8801-01', 'EVD-8801-02', 'EVD-8801-03'],
        suggestedActions: ['Issue Subpoena for Apex Bio-Labs Sales Ledger', 'Request Search Warrant for Black Audi A8']
      };

      setCopilotMessages((prev) => [...prev, copilotResponse]);
    }, 600);
  };

  return { messages: copilotMessages, send };
};
