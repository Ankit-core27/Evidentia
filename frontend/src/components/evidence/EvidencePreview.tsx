import React from 'react';
import { FileQuestion } from 'lucide-react';
import { fileUrl, isMockMode } from '@/lib/api';
import { EvidenceDetail } from '@/types/api';

/** The original file, shown the way the browser can: PDF frame, image, audio or video player, or text. */
export const EvidencePreview: React.FC<{ evidence: EvidenceDetail }> = ({ evidence }) => {
  const url = fileUrl(evidence.id);
  const mime = evidence.mime_type;

  if (!url) {
    return (
      <Unavailable
        message={
          isMockMode
            ? 'The mock backend has no original file for this item. The real backend serves every original.'
            : 'The original file is not available.'
        }
      />
    );
  }

  if (mime === 'application/pdf') {
    return <iframe src={url} title={evidence.title} className="w-full h-[60vh] rounded-xl border border-slate-800 bg-white" />;
  }
  if (mime.startsWith('image/')) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-2 flex justify-center">
        <img src={url} alt={evidence.title} className="max-h-[60vh] object-contain" />
      </div>
    );
  }
  if (mime.startsWith('audio/')) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
        <audio controls src={url} className="w-full" aria-label={evidence.title} />
      </div>
    );
  }
  if (mime.startsWith('video/')) {
    return <video controls src={url} className="w-full max-h-[60vh] rounded-xl border border-slate-800 bg-black" aria-label={evidence.title} />;
  }
  if (evidence.extracted_text) {
    return (
      <pre className="whitespace-pre-wrap text-xs text-slate-200 leading-relaxed p-4 rounded-xl border border-slate-800 bg-slate-950 max-h-[60vh] overflow-y-auto">
        {evidence.extracted_text}
      </pre>
    );
  }
  return <Unavailable message={`No preview for ${mime || 'this file type'}. Download it to open it.`} />;
};

const Unavailable: React.FC<{ message: string }> = ({ message }) => (
  <div className="p-8 rounded-xl border border-dashed border-slate-700 text-center text-xs text-slate-400 space-y-2">
    <FileQuestion className="w-6 h-6 mx-auto text-slate-500" />
    <p>{message}</p>
  </div>
);
