import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react';
import { CitationChip } from '@/components/shared/CitationChip';
import { inputClass, primaryButtonClass, smallButtonClass } from '@/components/shared/formStyles';
import { useEvidenceInspector } from '@/hooks/useEvidenceInspector';
import { api } from '@/lib/api';
import { CopilotTurn, useCopilotStore } from '@/stores/copilot';
import { AskResponse, Id } from '@/types/api';

const EXAMPLE_QUESTIONS = [
  'Summarise what happened, in order.',
  'Who are the witnesses, and what did each of them see?',
  'Where do the statements disagree?',
  'What injuries were recorded?'
];

const EMPTY: CopilotTurn[] = [];
const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** Questions about a case's evidence, answered from cited passages (POST /api/cases/{id}/ask). */
export const AskPanel: React.FC<{ caseId: Id }> = ({ caseId }) => {
  const turns = useCopilotStore((s) => s.conversations[caseId] ?? EMPTY);
  const pending = useCopilotStore((s) => s.pending[caseId] ?? false);
  const { append, remove, clear, setPending } = useCopilotStore.getState();
  const { open } = useEvidenceInspector();
  const [input, setInput] = useState('');
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns.length, pending]);

  const ask = async (question: string) => {
    const text = question.trim();
    // Read the store directly: a retry has just removed turns this render hasn't seen.
    const state = useCopilotStore.getState();
    if (!text || state.pending[caseId]) return;
    // Previous turns, without failed answers, give the backend the conversation so far.
    const history = (state.conversations[caseId] ?? [])
      .filter((t) => !t.error)
      .map((t) => ({ role: t.role, content: t.content }));
    append(caseId, { id: newId(), role: 'user', content: text });
    setPending(caseId, true);
    try {
      const response = await api.post<AskResponse>(`/cases/${caseId}/ask`, { question: text, history });
      append(caseId, {
        id: newId(),
        role: 'assistant',
        content: response.answer,
        citations: response.citations,
        followUps: response.follow_ups
      });
    } catch (error) {
      append(caseId, {
        id: newId(),
        role: 'assistant',
        content: '',
        error: error instanceof Error ? error.message : 'The question could not be answered.'
      });
    } finally {
      setPending(caseId, false);
    }
  };

  const retry = (errorTurn: CopilotTurn) => {
    const index = turns.findIndex((t) => t.id === errorTurn.id);
    const question = turns[index - 1];
    if (!question || question.role !== 'user') return;
    remove(caseId, errorTurn.id);
    remove(caseId, question.id);
    void ask(question.content);
  };

  const lastAssistant = [...turns].reverse().find((t) => t.role === 'assistant' && !t.error);

  /** The Q and A markers in the left gutter make the feed read like an interview record. */
  const gutter = (mark: string) => (
    <span className="w-6 shrink-0 pt-0.5 font-mono text-xs text-ink-faint" aria-hidden>
      {mark}
    </span>
  );

  return (
    <div className="space-y-3">
      <div
        ref={feedRef}
        className="rounded-md border border-line bg-surface px-4 py-4 h-[min(60vh,560px)] overflow-y-auto"
        aria-live="polite"
        data-testid="copilot-feed"
      >
        {turns.length === 0 && !pending && (
          <div className="max-w-xl space-y-3">
            <p className="text-body text-ink-soft">
              Ask about this case’s evidence. Answers come only from the case’s files, and every answer lists the passages it used.
            </p>
            <div className="space-y-1">
              <div className="text-xs text-ink-muted">For example</div>
              <ul className="space-y-0.5">
                {EXAMPLE_QUESTIONS.map((q) => (
                  <li key={q}>
                    <button onClick={() => void ask(q)} className="text-left text-body text-accent-text hover:underline underline-offset-2">
                      {q}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div>
          {turns.map((turn) =>
            turn.role === 'user' ? (
              <div key={turn.id} className="flex gap-2 mt-4 pt-4 border-t border-line first:mt-0 first:pt-0 first:border-t-0 pb-2">
                {gutter('Q')}
                <p className="text-sm font-medium text-ink whitespace-pre-wrap">{turn.content}</p>
              </div>
            ) : (
              <div key={turn.id} className="flex gap-2" data-testid="copilot-answer">
                {gutter('A')}
                {turn.error ? (
                  <div className="flex-1 min-w-0 space-y-2" role="alert">
                    <p className="text-body text-danger flex items-start gap-2">
                      <AlertTriangle className="size-4 shrink-0 mt-0.5" aria-hidden /> {turn.error}
                    </p>
                    <button onClick={() => retry(turn)} disabled={pending} className={smallButtonClass}>
                      <RotateCcw className="size-3" aria-hidden /> Ask again
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="text-body text-ink-soft leading-relaxed whitespace-pre-wrap max-w-3xl">{turn.content}</div>

                    {!!turn.citations?.length && (
                      <div className="space-y-2">
                        <div className="text-xs text-ink-muted">Sources</div>
                        <ol className="space-y-2">
                          {turn.citations.map((c, i) => (
                            <li key={`${c.chunk_id}-${i}`} className="space-y-0.5">
                              <CitationChip citation={c} index={i + 1} onOpen={() => open(c.evidence_id, c.passage)} />
                              <p className="pl-3 border-l-2 border-line-strong text-xs text-ink-muted italic line-clamp-3">“{c.passage}”</p>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {turn === lastAssistant && !!turn.followUps?.length && (
                      <div className="space-y-1">
                        <div className="text-xs text-ink-muted">Follow-up questions</div>
                        <ul className="space-y-0.5">
                          {turn.followUps.map((q) => (
                            <li key={q}>
                              <button
                                onClick={() => void ask(q)}
                                disabled={pending}
                                className="text-left text-body text-accent-text hover:underline underline-offset-2 disabled:opacity-50"
                              >
                                {q}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          )}
        </div>

        {pending && (
          <div className="flex gap-2 py-2" role="status">
            {gutter('A')}
            <span className="text-body text-ink-muted flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin text-accent-text" aria-hidden /> Searching the evidence…
            </span>
          </div>
        )}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
          setInput('');
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about people, vehicles, times, places or statements in this case"
          aria-label="Question"
          className={`${inputClass} h-9`}
        />
        <button type="submit" disabled={pending || !input.trim()} className={`${primaryButtonClass} h-9 px-4`}>
          Ask
        </button>
        {turns.length > 0 && (
          <button
            type="button"
            onClick={() => clear(caseId)}
            disabled={pending}
            title="Clear this conversation"
            className={`${smallButtonClass} h-9`}
          >
            Clear
          </button>
        )}
      </form>
    </div>
  );
};
