import React from 'react';
import { initials } from '@/lib/format';

const COLOURS = [
  'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
  'bg-purple-500/15 text-purple-300 border-purple-500/40',
  'bg-amber-500/15 text-amber-300 border-amber-500/40',
  'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  'bg-blue-500/15 text-blue-300 border-blue-500/40'
];

const SIZES = { sm: 'w-7 h-7 text-[10px]', md: 'w-10 h-10 text-xs', lg: 'w-12 h-12 text-sm' };

/** Persons and investigators have no photo in the data model, so they get initials. */
export const InitialsAvatar: React.FC<{ name: string; size?: keyof typeof SIZES }> = ({ name, size = 'md' }) => {
  const colour = COLOURS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % COLOURS.length];
  return (
    <div
      className={`${SIZES[size]} ${colour} rounded-lg border font-mono font-bold flex items-center justify-center shrink-0`}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
};
