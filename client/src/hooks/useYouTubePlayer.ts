import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  apiPromise ??= new Promise((resolve) => {
    window.onYouTubeIframeAPIReady = () => resolve();
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  });
  return apiPromise;
}

/** Crée un lecteur YouTube dans l'élément référencé et le renvoie une fois prêt */
export function useYouTubePlayer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [player, setPlayer] = useState<YT.Player | null>(null);
  /** Callback appelé à chaque changement d'état du lecteur (lecture, pause, chargement…) */
  const onStateChangeRef = useRef<((state: YT.PlayerState) => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    let instance: YT.Player | null = null;

    loadYouTubeApi().then(() => {
      if (cancelled || !containerRef.current) return;
      const target = document.createElement('div');
      containerRef.current.appendChild(target);
      instance = new YT.Player(target, {
        width: '100%',
        height: '100%',
        playerVars: { controls: 0, disablekb: 1, playsinline: 1, rel: 0, iv_load_policy: 3 },
        events: {
          onReady: () => !cancelled && setPlayer(instance),
          onStateChange: (e) => onStateChangeRef.current?.(e.data),
        },
      });
    });

    return () => {
      cancelled = true;
      instance?.destroy();
      setPlayer(null);
    };
  }, []);

  return { containerRef, player, onStateChangeRef };
}
