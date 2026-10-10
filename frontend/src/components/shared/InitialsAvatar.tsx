import React from 'react';
import { initials } from '@/lib/format';

const SIZES = { sm: 'size-6 text-2xs', md: 'size-8 text-xs', lg: 'size-10 text-body' };

/**
 * Persons and investigators have no photo in the data model, so they get initials.
 * One neutral style: colour on a person would read as a status it doesn't have.
 */
export const InitialsAvatar: React.FC<{ name: string; size?: keyof typeof SIZES }> = ({ name, size = 'md' }) => (
  <div
    className={`${SIZES[size]} rounded-full bg-raised border border-line-strong text-ink-soft font-medium flex items-center justify-center shrink-0`}
    aria-hidden
  >
    {initials(name)}
  </div>
);
