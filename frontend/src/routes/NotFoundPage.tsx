import React from 'react';
import { Link } from 'react-router-dom';
import { SearchX } from 'lucide-react';

interface NotFoundPageProps {
  title?: string;
  message?: string;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({
  title = 'Page not found',
  message = 'This address does not match any page.'
}) => {
  return (
    <div className="p-6">
      <div className="max-w-lg mx-auto mt-16 p-8 rounded-2xl bg-slate-900/80 border border-slate-800 text-center space-y-3 font-mono">
        <SearchX className="w-8 h-8 text-cyan-400 mx-auto" />
        <h1 className="text-lg font-bold text-slate-100">{title}</h1>
        <p className="text-xs text-slate-400">{message}</p>
        <div className="flex items-center justify-center gap-2 pt-2 text-xs">
          <Link
            to="/cases"
            className="px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
          >
            Cases Directory
          </Link>
          <Link
            to="/"
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};
