import React from 'react';
import { AlertTriangle, Inbox, Loader2, RotateCcw } from 'lucide-react';
import { ApiError } from '@/lib/api';

export const LoadingState: React.FC<{ label?: string; className?: string }> = ({ label = 'Loading…', className = '' }) => (
  <div className={`flex items-center justify-center gap-2 p-8 text-xs text-slate-400 font-mono ${className}`} role="status">
    <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
    <span>{label}</span>
  </div>
);

export const ErrorState: React.FC<{ error: unknown; onRetry?: () => void; className?: string }> = ({
  error,
  onRetry,
  className = ''
}) => {
  const message = error instanceof ApiError || error instanceof Error ? error.message : 'Something went wrong.';
  return (
    <div
      className={`p-4 rounded-xl bg-red-950/30 border border-red-500/30 text-xs text-red-200 font-mono flex items-start justify-between gap-3 ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
        <span>{message}</span>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 flex items-center gap-1 shrink-0"
        >
          <RotateCcw className="w-3 h-3" /> Retry
        </button>
      )}
    </div>
  );
};

export const EmptyState: React.FC<{ title: string; message?: string; action?: React.ReactNode; className?: string }> = ({
  title,
  message,
  action,
  className = ''
}) => (
  <div
    className={`p-8 rounded-2xl bg-slate-900/60 border border-dashed border-slate-800 text-center font-mono space-y-2 ${className}`}
  >
    <Inbox className="w-6 h-6 text-slate-600 mx-auto" />
    <div className="text-xs font-bold text-slate-300">{title}</div>
    {message && <p className="text-[11px] text-slate-500 max-w-md mx-auto">{message}</p>}
    {action && <div className="pt-2">{action}</div>}
  </div>
);

interface QueryLike<T> {
  data: T | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
}

/**
 * Renders loading, error and empty states for a query, and `children(data)` otherwise.
 * `isEmpty` defaults to checking for an empty array.
 */
export function QueryBoundary<T>({
  query,
  children,
  loadingLabel,
  empty,
  isEmpty = (data) => Array.isArray(data) && data.length === 0
}: {
  query: QueryLike<T>;
  children: (data: T) => React.ReactNode;
  loadingLabel?: string;
  empty?: React.ReactNode;
  isEmpty?: (data: T) => boolean;
}) {
  if (query.isPending) return <LoadingState label={loadingLabel} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (query.data === undefined) return null;
  if (empty && isEmpty(query.data)) return <>{empty}</>;
  return <>{children(query.data)}</>;
}
