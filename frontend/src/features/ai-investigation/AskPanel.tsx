import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bot, Loader2, RotateCcw, Send, Trash2, User } from 'lucide-react';
import { CitationChip } from '@/components/shared/CitationChip';
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

  return (
    <div className="space-y-3">
      <div
        ref={feedRef}
        className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-4 h-[460px] overflow-y-auto"
        aria-live="polite"
        data-testid="copilot-feed"
      >
        {turns.length === 0 && !pending && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3">
            <Bot className="w-8 h-8 text-cyan-400" />
            <p className="text-xs text-slate-300 max-w-md">
              Ask about this case's evidence. Answers come only from the case's files and cite the passages they use.
            </p>
            <div className="flex flex-wrap justify-center gap-2 max-w-xl">
              {EXAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => void ask(q)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500/40 text-[11px] text-cyan-300"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn) =>
          turn.role === 'user' ? (
            <div key={turn.id} className="flex gap-3 justify-end">
              <div className="p-3 rounded-2xl rounded-br-none max-w-2xl text-xs leading-relaxed bg-cyan-600 text-white whitespace-pre-wrap">
                {turn.content}
              </div>
              <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center shrink-0">
                <User className="w-4 h-4" />
              </div>
            </div>
          ) : (
            <div key={turn.id} className="flex gap-3" data-testid="copilot-answer">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              {turn.error ? (
                <div className="p-3 rounded-2xl rounded-bl-none max-w-2xl text-xs bg-red-950/40 border border-red-500/30 text-red-200 space-y-2" role="alert">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" /> {turn.error}
                  </div>
                  <button
                    onClick={() => retry(turn)}
                    disabled={pending}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-[11px] flex items-center gap-1 disabled:opacity-50"
                  >
                    <RotateCcw className="w-3 h-3" /> Retry
                  </button>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl rounded-bl-none max-w-3xl text-xs leading-relaxed bg-slate-950 border border-slate-800 text-slate-200 space-y-3">
                  <div className="whitespace-pre-wrap">{turn.content}</div>

                  {!!turn.citations?.length && (
                    <div className="pt-2 border-t border-slate-800 space-y-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Sources</span>
                      {turn.citations.map((c, i) => (
                        <div key={`${c.chunk_id}-${i}`} className="flex flex-col gap-1">
                          <CitationChip citation={c} index={i + 1} onOpen={() => open(c.evidence_id, c.passage)} />
                          <p className="text-[11px] text-slate-400 italic pl-1 line-clamp-3">"{c.passage}"</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {turn === lastAssistant && !!turn.followUps?.length && (
                    <div className="pt-2 space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold block">Follow-up questions</span>
                      {turn.followUps.map((q) => (
                        <button
                          key={q}
                          onClick={() => void ask(q)}
                          disabled={pending}
                          className="block text-left w-full px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 text-[11px] border border-slate-800 transition-colors disabled:opacity-50"
                        >
                          → {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        )}

        {pending && (
          <div className="flex gap-3" role="status">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-3 rounded-2xl rounded-bl-none text-xs bg-slate-950 border border-slate-800 text-slate-400 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" /> Searching the evidence…
            </div>
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
          placeholder="Ask about people, vehicles, times, places or statements in this case…"
          aria-label="Question"
          className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-2 disabled:opacity-50"
        >
          <span>Ask</span>
          <Send className="w-3.5 h-3.5" />
        </button>
        {turns.length > 0 && (
          <button
            type="button"
            onClick={() => clear(caseId)}
            disabled={pending}
            title="Clear conversation"
            aria-label="Clear conversation"
            className="px-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-red-300 disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </form>
    </div>
  );
};
