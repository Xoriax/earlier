import { createContext, useContext, useLayoutEffect, useState, type ReactNode, type RefObject } from 'react';
import { useYouTubePlayer } from '../hooks/useYouTubePlayer';

interface PlayerContextValue {
  player: YT.Player | null;
  onStateChangeRef: RefObject<((state: YT.PlayerState) => void) | null>;
  /** Élément de la page sur lequel le lecteur doit s'afficher */
  setSlot: (el: HTMLElement | null) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer doit être utilisé dans <PlayerProvider>');
  return ctx;
}

// Chrome met en veille les iframes hors écran : le lecteur reste donc dans la fenêtre,
// mais invisible, pour pouvoir s'initialiser avant la partie
const HIDDEN = { bottom: 0, right: 0, width: 320, height: 180, opacity: 0, zIndex: -1 };

type Box = typeof HIDDEN | { top: number; left: number; width: number; height: number };

/**
 * Crée le lecteur YouTube dès l'ouverture du site et le garde en vie,
 * pour qu'il soit prêt avant la première manche. Il se superpose à l'emplacement
 * enregistré via setSlot, et reste invisible sinon.
 */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const { containerRef, player, onStateChangeRef } = useYouTubePlayer();
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [box, setBox] = useState<Box>(HIDDEN);

  useLayoutEffect(() => {
    if (!slot) {
      setBox(HIDDEN);
      return;
    }
    const update = () => {
      const { top, left, width, height } = slot.getBoundingClientRect();
      setBox({ top, left, width, height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(slot);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [slot]);

  return (
    <PlayerContext.Provider value={{ player, onStateChangeRef, setSlot }}>
      {children}
      <div
        ref={containerRef}
        aria-hidden={!slot}
        className="pointer-events-none fixed z-0 overflow-hidden rounded-2xl"
        style={box}
      />
    </PlayerContext.Provider>
  );
}
