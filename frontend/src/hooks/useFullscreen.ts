import { useEffect, useState } from 'react';

/** The element shown full screen, or null. Re-renders when it changes. */
export const useFullscreenElement = () => {
  const [element, setElement] = useState<Element | null>(() => (typeof document === 'undefined' ? null : document.fullscreenElement));
  useEffect(() => {
    const onChange = () => setElement(document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  return element;
};

/**
 * Where app-wide overlays (dialogs, the evidence inspector) mount: the element shown
 * full screen if there is one, because the browser hides everything outside it.
 */
export const useOverlayRoot = () => {
  const element = useFullscreenElement();
  return (element as HTMLElement | null) ?? (typeof document === 'undefined' ? null : document.body);
};
