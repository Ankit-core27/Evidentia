import React, { useState } from 'react';
import { Bot, Send } from 'lucide-react';
import { CopilotMessage } from '@/types';

interface CopilotPanelProps {
  messages: CopilotMessage[];
  onSend: (question: string) => void;
}

export const CopilotPanel: React.FC<CopilotPanelProps> = ({ messages, onSend }) => {
  const [input, setInput] = useState('');

  const handleSubmit = () => {
    if (!input.trim()) return;
    onSend(input);
    setInput('');
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Bot className="w-5 h-5 text-cyan-400" />
            AI Forensic Copilot Assistant
          </h2>
          <p className="text-xs text-slate-400">
            Ask questions about DNA STR loci, cell telemetry, toxicology matches, or evidence links.
          </p>
        </div>
      </div>

      {/* Copilot Chat Feed */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-4 h-[420px] overflow-y-auto">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.sender === 'copilot' && (
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div className={`p-3.5 rounded-2xl max-w-2xl text-xs leading-relaxed space-y-2 ${
              msg.sender === 'user'
                ? 'bg-cyan-600 text-white rounded-br-none'
                : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-bl-none'
            }`}>
              <div className="whitespace-pre-wrap">{msg.text}</div>

              {msg.citations && msg.citations.length > 0 && (
                <div className="pt-2 border-t border-slate-800 flex items-center gap-1.5 flex-wrap text-[10px] text-cyan-400">
                  <span>Citations:</span>
                  {msg.citations.map((c, i) => (
                    <span key={i} className="px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30">
                      {c}
                    </span>
                  ))}
                </div>
              )}

              {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                <div className="pt-2 space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold block">Suggested Actions:</span>
                  {msg.suggestedActions.map((act, i) => (
                    <button
                      key={i}
                      onClick={() => onSend(act)}
                      className="block text-left w-full px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 text-[10px] border border-slate-800 transition-colors"
                    >
                      → {act}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input Bar */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Ask AI Copilot regarding victim, suspect alibi, DNA match, or phone logs..."
          className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
        />
        <button
          onClick={() => handleSubmit()}
          className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-2"
        >
          <span>Ask</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
