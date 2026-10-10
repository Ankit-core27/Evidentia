import { RefObject, useEffect } from 'react';

/** Calls `onOutside` on a mouse down outside `ref` or on Escape, while `active`. */
export const useClickOutside = (ref: RefObject<HTMLElement | null>, onOutside: () => void, active = true) => {
  useEffect(() => {
    if (!active) return;
    const handleMouseDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onOutside();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOutside();
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [ref, onOutside, active]);
};
