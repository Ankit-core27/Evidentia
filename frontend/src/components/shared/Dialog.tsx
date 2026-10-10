import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { iconButtonClass } from './formStyles';

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Blocks closing, for example while a save is running. */
  busy?: boolean;
  width?: string;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keeps keyboard focus inside an open dialog or drawer: focus moves in when it opens,
 * Tab wraps around, and focus returns to where it was when it closes.
 */
export const useFocusTrap = (ref: React.RefObject<HTMLElement | null>, active: boolean) => {
  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    // Leave focus alone if a field inside already took it (autoFocus).
    if (node && !node.contains(document.activeElement)) node.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === node)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [ref, active]);
};

/** A modal dialog: Escape and the backdrop close it unless `busy`. */
export const Dialog: React.FC<DialogProps> = ({ open, title, onClose, children, footer, busy = false, width = 'max-w-lg' }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${width} bg-surface border border-line-strong rounded-t-lg sm:rounded-lg shadow-overlay flex flex-col max-h-[92vh] sm:max-h-[90vh] focus:outline-none`}
      >
        <div className="pl-5 pr-3 h-12 border-b border-line flex items-center justify-between gap-3 shrink-0">
          <h2 className="text-sm font-semibold text-ink truncate">{title}</h2>
          <button onClick={onClose} disabled={busy} className={iconButtonClass} aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto space-y-4">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-line flex items-center justify-end gap-2 shrink-0">{footer}</div>}
      </div>
    </div>
  );
};
