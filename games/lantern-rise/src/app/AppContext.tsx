// Shared resources available to every component: loaded images, reduced-motion
// preference, and the persisted mute state.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { audio } from '../platform/audio';

interface AppCtx {
  images: Map<string, HTMLImageElement>;
  imageOk: Map<string, boolean>;
  reducedMotion: boolean;
  muted: boolean;
  toggleMute: () => void;
}

const Ctx = createContext<AppCtx | null>(null);

const MUTE_KEY = 'lantern-rise.muted';

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    } catch {
      return;
    }
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

export function AppProvider({
  images,
  imageOk,
  children,
}: {
  images: Map<string, HTMLImageElement>;
  imageOk: Map<string, boolean>;
  children: ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  const [muted, setMuted] = useState<boolean>(() => readMuted());

  useEffect(() => {
    audio.setMuted(muted);
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [muted]);

  const value = useMemo<AppCtx>(
    () => ({
      images,
      imageOk,
      reducedMotion,
      muted,
      toggleMute: () => setMuted((m) => !m),
    }),
    [images, imageOk, reducedMotion, muted],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
