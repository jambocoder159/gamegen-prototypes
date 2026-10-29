import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AudioManager } from './audio';

const MUTE_KEY = 'mahjong-deck.muted';

interface AudioCtx {
  manager: AudioManager;
  muted: boolean;
  toggleMuted: () => void;
}

const Ctx = createContext<AudioCtx | null>(null);

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function AudioProvider({ manager, children }: { manager: AudioManager; children: ReactNode }) {
  const [muted, setMuted] = useState<boolean>(() => {
    const m = readMuted();
    manager.setMuted(m);
    return m;
  });

  const toggleMuted = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      manager.setMuted(next);
      try {
        localStorage.setItem(MUTE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [manager]);

  const value = useMemo<AudioCtx>(
    () => ({ manager, muted, toggleMuted }),
    [manager, muted, toggleMuted],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAudio(): AudioCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAudio must be used within AudioProvider');
  return ctx;
}
