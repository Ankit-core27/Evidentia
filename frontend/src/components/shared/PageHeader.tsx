import React from 'react';

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Buttons or controls on the right; they wrap under the title on narrow screens. */
  actions?: React.ReactNode;
  /** `page` is the h1 of an agency page; `module` is the h2 of a case workspace module. */
  level?: 'page' | 'module';
  className?: string;
}

/** The title row of a page or workspace module. */
export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, actions, level = 'module', className = '' }) => {
  const Heading = level === 'page' ? 'h1' : 'h2';
  return (
    <div className={`flex flex-col sm:flex-row sm:items-end justify-between gap-x-6 gap-y-3 ${className}`}>
      <div className="min-w-0">
        <Heading className={`${level === 'page' ? 'text-xl' : 'text-base'} font-semibold text-ink tracking-tight`}>{title}</Heading>
        {description && <p className="text-body text-ink-muted mt-0.5 max-w-3xl">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
};

/** A heading inside a page or module, with an optional count and a link or action on the right. */
export const SectionHeader: React.FC<{
  title: React.ReactNode;
  count?: number;
  action?: React.ReactNode;
  as?: 'h2' | 'h3';
  className?: string;
}> = ({ title, count, action, as: Heading = 'h3', className = '' }) => (
  <div className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-2 min-h-7 ${className}`}>
    <Heading className="text-body font-semibold text-ink">
      {title}
      {count !== undefined && <span className="ml-1.5 font-mono text-xs font-normal text-ink-muted">{count}</span>}
    </Heading>
    {action && <div className="min-w-0 max-w-full">{action}</div>}
  </div>
);
