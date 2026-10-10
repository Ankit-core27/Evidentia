import React from 'react';
import { Users, CheckCircle2 } from 'lucide-react';
import { ForensicCase } from '@/types';

interface PersonsModuleProps {
  forensicCase: ForensicCase;
}

// Witnesses and persons of interest.
export const PersonsModule: React.FC<PersonsModuleProps> = ({ forensicCase }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            Persons of Interest & Witness Statements
          </h2>
          <p className="text-xs text-slate-400">
            Interrogation summaries, alibi statuses, and threat level assignments.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {forensicCase.personsOfInterest.map((poi) => (
          <div key={poi.id} className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={poi.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80'}
                  alt={poi.name}
                  className="w-10 h-10 rounded-xl object-cover border border-slate-700"
                />
                <div>
                  <h3 className="text-sm font-bold text-slate-100">{poi.name}</h3>
                  <span className="text-xs text-cyan-400 block">{poi.role}</span>
                </div>
              </div>

              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                poi.threatLevel === 'Severe' || poi.threatLevel === 'High'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              }`}>
                {poi.threatLevel}
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              {poi.notes}
            </p>

            {poi.dnaMatch && (
              <div className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> {poi.dnaMatch}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
