import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Id } from '@/types/api';

const MAX_PASSAGE_LENGTH = 300;

/**
 * The evidence inspector is opened through the URL (?evidence=<id>&passage=<text>), so a
 * citation, source passage or evidence card anywhere can open it, and the browser back
 * button closes it.
 */
export const useEvidenceInspector = () => {
  const [params, setParams] = useSearchParams();
  const raw = params.get('evidence');
  const evidenceId = raw && /^\d+$/.test(raw) ? Number(raw) : null;
  const passage = params.get('passage');

  const open = useCallback(
    (id: Id, passageText?: string | null) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('evidence', String(id));
        if (passageText) next.set('passage', passageText.slice(0, MAX_PASSAGE_LENGTH));
        else next.delete('passage');
        return next;
      }),
    [setParams]
  );

  const close = useCallback(
    () =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('evidence');
        next.delete('passage');
        return next;
      }),
    [setParams]
  );

  return { evidenceId, passage, open, close };
};
