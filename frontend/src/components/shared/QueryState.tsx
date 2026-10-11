import React from 'react';
import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { smallButtonClass } from './formStyles';

export const LoadingState: React.FC<{ label?: string; className?: string }> = ({ label = 'Loading…', className = '' }) => (
  <div className={`flex items-center gap-2 py-6 text-body text-ink-muted ${className}`} role="status">
    <Loader2 className="size-4 animate-spin text-accent-text" aria-hidden />
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
      className={`px-3 py-2.5 rounded-md border border-danger/40 bg-danger/10 text-body text-ink flex items-start justify-between gap-3 ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-2 min-w-0">
        <AlertTriangle className="size-4 text-danger shrink-0 mt-0.5" aria-hidden />
        <span className="break-words">{message}</span>
      </div>
      {onRetry && (
        <button onClick={onRetry} className={`${smallButtonClass} shrink-0`}>
          <RotateCcw className="size-3" aria-hidden /> Retry
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
  <div className={`px-4 py-8 rounded-md border border-line bg-surface text-center space-y-1 ${className}`}>
    <div className="text-body font-medium text-ink-soft">{title}</div>
    {message && <p className="text-xs text-ink-muted max-w-md mx-auto">{message}</p>}
    {action && <div className="pt-3">{action}</div>}
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
