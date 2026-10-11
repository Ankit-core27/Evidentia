import React from 'react';

export interface SegmentOption<T extends string> {
  value: T;
  label: React.ReactNode;
  count?: number;
}

/**
 * Switches between views of the same content: an underlined tab row (role="tab").
 * Keep it for views; use FilterChips for narrowing a list.
 */
export function Tabs<T extends string>({
  options,
  value,
  onChange,
  label,
  className = ''
}: {
  options: SegmentOption<NoInfer<T>>[];
  value: T;
  onChange: (value: NoInfer<T>) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={`flex items-center gap-4 border-b border-line overflow-x-auto ${className}`}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(o.value)}
            className={`-mb-px h-9 border-b-2 text-body whitespace-nowrap transition-colors ${
              selected ? 'border-accent text-ink font-medium' : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={`ml-1.5 font-mono text-xs ${selected ? 'text-ink-soft' : 'text-ink-faint'}`}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Toggle chips that narrow a list (aria-pressed). */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  label,
  className = ''
}: {
  options: SegmentOption<NoInfer<T>>[];
  value: T;
  onChange: (value: NoInfer<T>) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={`flex items-center gap-1.5 overflow-x-auto ${className}`}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            aria-pressed={selected}
            onClick={() => onChange(o.value)}
            className={`h-7 px-2.5 rounded border text-xs whitespace-nowrap transition-colors ${
              selected
                ? 'border-accent/60 bg-accent/10 text-ink'
                : 'border-line-strong bg-surface text-ink-muted hover:text-ink hover:border-control'
            }`}
          >
            {o.label}
            {o.count !== undefined && <span className="ml-1.5 font-mono text-2xs text-ink-muted">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
