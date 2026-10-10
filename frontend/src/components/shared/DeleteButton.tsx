import React, { useEffect, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';

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

  if (busy) return <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />;
  return armed ? (
    <button
      onClick={() => {
        setArmed(false);
        onDelete();
      }}
      className="px-2 py-0.5 rounded bg-red-500/15 border border-red-500/40 text-red-300 text-[10px] font-bold"
    >
      Confirm delete
    </button>
  ) : (
    <button
      onClick={() => setArmed(true)}
      className="p-1 rounded text-slate-500 hover:text-red-400"
      title={`Delete ${label}`}
      aria-label={`Delete ${label}`}
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
};
