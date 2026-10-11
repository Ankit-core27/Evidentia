import React, { useEffect, useRef, useState } from 'react';

const SEEN_KEY = 'evidentia:intro-seen';
// Served from the repo-root assets/ folder (vite publicDir).
const INTRO_SRC = '/intro/forensix-loader.mp4';
// If the video stalls or never loads, don't keep the app hidden behind it.
const MAX_INTRO_MS = 9000;

function shouldPlayIntro(): boolean {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  try {
    return !sessionStorage.getItem(SEEN_KEY);
  } catch {
    return true;
  }
}

/** Plays the Evidentia intro video over the app the first time it opens in a browser session. */
export const IntroSplash: React.FC = () => {
  const [visible, setVisible] = useState(shouldPlayIntro);
  const [leaving, setLeaving] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const finish = () => setLeaving(true);

  useEffect(() => {
    if (!visible) return;
    try {
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      // Storage blocked: the intro just plays again on the next load.
    }
    // Autoplay can still be refused (e.g. data saver); go straight to the app then.
    videoRef.current?.play().catch(finish);
    const timer = window.setTimeout(finish, MAX_INTRO_MS);
    return () => window.clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] bg-canvas transition-opacity duration-300 ${leaving ? 'opacity-0' : ''}`}
      onTransitionEnd={() => leaving && setVisible(false)}
    >
      <video
        ref={videoRef}
        aria-hidden
        src={INTRO_SRC}
        muted
        playsInline
        preload="auto"
        onEnded={finish}
        onError={finish}
        className="size-full object-cover"
      />
      <button
        type="button"
        onClick={finish}
        className="absolute bottom-6 right-6 h-8 px-3 rounded border border-line-strong text-2xs text-ink-muted hover:text-ink hover:bg-hover"
      >
        Skip intro
      </button>
    </div>
  );
};
