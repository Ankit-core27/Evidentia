import React, { useEffect, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { iconButtonClass } from './formStyles';

/** Delete with a second click to confirm. The confirmation resets after a few seconds. */
export const DeleteButton: React.FC<{ onDelete: () => void; busy?: boolean; label: string }> = ({
  onDelete,
  busy = false,
  label
}) => {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);

  if (busy) {
    return (
      <span className="inline-flex items-center justify-center size-7" role="status" aria-label={`Deleting ${label}`}>
        <Loader2 className="size-3.5 text-ink-muted animate-spin" />
      </span>
    );
  }
  return armed ? (
    <button
      onClick={() => {
        setArmed(false);
        onDelete();
      }}
      className="h-7 px-2 rounded bg-danger/15 border border-danger/50 text-danger text-xs font-medium whitespace-nowrap"
    >
      Confirm delete
    </button>
  ) : (
    <button onClick={() => setArmed(true)} className={`${iconButtonClass} hover:text-danger`} title={`Delete ${label}`} aria-label={`Delete ${label}`}>
      <Trash2 className="size-3.5" />
    </button>
  );
};
