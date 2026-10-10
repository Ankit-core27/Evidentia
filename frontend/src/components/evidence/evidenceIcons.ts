import type { ElementType } from 'react';
import { File, FileText, Image, MessageSquareQuote, Stethoscope, Video, Volume2 } from 'lucide-react';
import { EvidenceType } from '@/types/api';

export const EVIDENCE_ICONS: Record<EvidenceType, { icon: ElementType; colour: string }> = {
  document: { icon: FileText, colour: 'text-blue-400' },
  statement: { icon: MessageSquareQuote, colour: 'text-cyan-400' },
  photo: { icon: Image, colour: 'text-emerald-400' },
  video: { icon: Video, colour: 'text-purple-400' },
  audio: { icon: Volume2, colour: 'text-amber-400' },
  medical: { icon: Stethoscope, colour: 'text-red-400' },
  other: { icon: File, colour: 'text-slate-400' }
};
