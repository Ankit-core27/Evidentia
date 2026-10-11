import { File, FileText, Image, MessageSquareQuote, Stethoscope, Video, Volume2, type LucideIcon } from 'lucide-react';
import { EvidenceType } from '@/types/api';

/** One icon per evidence type. They stay neutral: the type label carries the meaning, colour is kept for status. */
export const EVIDENCE_ICONS: Record<EvidenceType, { icon: LucideIcon }> = {
  document: { icon: FileText },
  statement: { icon: MessageSquareQuote },
  photo: { icon: Image },
  video: { icon: Video },
  audio: { icon: Volume2 },
  medical: { icon: Stethoscope },
  other: { icon: File }
};
