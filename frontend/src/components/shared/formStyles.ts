// Tailwind classes shared by forms and actions. Tokens are defined in src/index.css.
export const labelClass = 'block text-xs font-medium text-ink-soft mb-1';
const field =
  'px-2.5 py-1.5 bg-well border border-control/60 rounded text-body text-ink placeholder:text-ink-faint hover:border-control focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-60';
export const inputClass = `w-full ${field}`;
/** Native selects share the input look; `color-scheme: dark` styles their option list. */
export const selectClass = inputClass;
/** A select that sizes to its options, for filters and toolbars. */
export const inlineSelectClass = field;

const button =
  'inline-flex items-center justify-center gap-1.5 rounded font-medium whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none';

/** The one main action of a view. */
export const primaryButtonClass = `${button} h-8 px-3 text-body bg-accent text-accent-fg hover:bg-accent-strong`;
/** Any other action next to it. */
export const secondaryButtonClass = `${button} h-8 px-3 text-body bg-raised text-ink border border-line-strong hover:bg-hover`;
/** Compact actions inside lists and toolbars. */
export const smallButtonClass = `${button} h-7 px-2 text-xs text-ink-soft border border-line-strong hover:text-ink hover:bg-raised`;
/** Square icon-only buttons; give each an aria-label. */
export const iconButtonClass =
  'inline-flex items-center justify-center size-7 rounded text-ink-muted hover:text-ink hover:bg-raised transition-colors disabled:opacity-50';
/** A text link styled action, for navigation inside a page. */
export const linkClass = 'text-accent-text hover:underline underline-offset-2';
