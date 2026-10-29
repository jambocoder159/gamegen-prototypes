// React binding around the pure logic: holds game state, best score, win/over
// flags, fires sound effects, and exposes the last move as a structured event so
// the UI can build a localised aria-live announcement.

import { useCallback, useRef, useState } from 'react';
import { move as applyMove, newGame, type Dir, type GameState } from './logic';
import type { AudioManager } from '../platform/audio';

const BEST_KEY = 'mochi.best';

function readBest(): number {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    const n = raw == null ? 0 : Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function writeBest(n: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(n));
  } catch {
    /* ignore */
  }
}

export interface MoveEvent {
  seq: number; // increments every move so aria-live re-announces
  merged: boolean;
  mergedTier: number;
  over: boolean;
  reachedWin: boolean;
  score: number;
}

let seedCounter = 1;
function freshSeed(): number {
  // Deterministic-enough variety without Math.random in logic; the logic itself
  // is seedable so tests/bot stay reproducible when they pass a fixed seed.
  seedCounter = (seedCounter * 1103515245 + 12345) & 0x7fffffff;
  return (seedCounter ^ (performance.now() | 0)) >>> 0;
}

export interface UseGame {
  state: GameState;
  best: number;
  newBest: boolean;
  showWin: boolean;
  event: MoveEvent | null;
  doMove: (dir: Dir) => boolean;
  restart: () => void;
  dismissWin: (keepPlaying: boolean) => void;
}

export function useGame(audio: AudioManager): UseGame {
  const [state, setState] = useState<GameState>(() => newGame(freshSeed()));
  const [best, setBest] = useState<number>(readBest);
  const [newBest, setNewBest] = useState(false);
  const [showWin, setShowWin] = useState(false);
  const [event, setEvent] = useState<MoveEvent | null>(null);
  const seqRef = useRef(0);

  const doMove = useCallback(
    (dir: Dir): boolean => {
      let didMove = false;
      setState((prev) => {
        if (prev.over) return prev;
        const res = applyMove(prev, dir);
        if (!res.changed) return prev;
        didMove = true;

        if (res.reachedWin) audio.playSfx('sfxWin');
        else if (res.merged) audio.playSfx('sfxMerge');
        else audio.playSfx('sfxMove');
        if (res.state.over) audio.playSfx('sfxOver');

        if (res.reachedWin) setShowWin(true);
        if (res.state.over && res.state.score > best) {
          setBest(res.state.score);
          writeBest(res.state.score);
          setNewBest(true);
        } else if (res.state.over) {
          setNewBest(false);
        }

        seqRef.current += 1;
        setEvent({
          seq: seqRef.current,
          merged: res.merged,
          mergedTier: res.mergedTier,
          over: res.state.over,
          reachedWin: res.reachedWin,
          score: res.state.score,
        });
        return res.state;
      });
      return didMove;
    },
    [audio, best],
  );

  const restart = useCallback(() => {
    setState(newGame(freshSeed()));
    setNewBest(false);
    setShowWin(false);
    setEvent(null);
    seqRef.current = 0;
  }, []);

  const dismissWin = useCallback(
    (keepPlaying: boolean) => {
      setShowWin(false);
      if (keepPlaying) {
        setState((prev) => ({ ...prev, keepGoing: true }));
      } else {
        restart();
      }
    },
    [restart],
  );

  return { state, best, newBest, showWin, event, doMove, restart, dismissWin };
}
