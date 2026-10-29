// React binding: one atomic run snapshot; saves after each completed move.
import { useCallback, useEffect, useRef, useState } from 'react';
import { move as applyMove, newGame, type Dir, type GameState } from './logic';
import { clearRun, saveRun, type SavedRun } from './storage';
import type { AudioManager } from '../platform/audio';

const BEST_KEY = 'mochi.best';
function readBest(): number {
  try {
    const n = Number(localStorage.getItem(BEST_KEY) ?? 0);
    return Number.isSafeInteger(n) && n >= 0 ? n : 0;
  } catch { return 0; }
}
function writeBest(n: number): void {
  try { localStorage.setItem(BEST_KEY, String(n)); } catch { /* optional storage */ }
}
export interface MoveEvent {
  seq: number;
  merged: boolean;
  mergedTier: number;
  over: boolean;
  reachedWin: boolean;
  score: number;
}
let seedCounter = 1;
function freshSeed(): number {
  seedCounter = (seedCounter * 1103515245 + 12345) & 0x7fffffff;
  return (seedCounter ^ (performance.now() | 0)) >>> 0;
}
interface Run { state: GameState; best: number; newBest: boolean; event: MoveEvent | null }
export function useGame(audio: AudioManager, savedRun: SavedRun | null) {
  const [run, setRun] = useState<Run>(() => ({
    state: savedRun?.state ?? newGame(freshSeed()),
    best: Math.max(readBest(), savedRun?.best ?? 0),
    newBest: savedRun?.newBest ?? false,
    event: null,
  }));
  // A ref lets consecutive input events observe the last accepted move immediately.
  const current = useRef(run);
  const commit = useCallback((next: Run) => {
    current.current = next;
    setRun(next);
    writeBest(next.best);
    saveRun(next.state, next.best, next.newBest);
  }, []);
  useEffect(() => {
    const flush = () => { const r = current.current; saveRun(r.state, r.best, r.newBest); };
    flush();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', flush);
    };
  }, []);
  const doMove = useCallback((dir: Dir): boolean => {
    const prev = current.current;
    if (prev.state.over || (prev.state.won && !prev.state.keepGoing)) return false;
    const res = applyMove(prev.state, dir);
    if (!res.changed) return false;
    audio.playSfx(res.reachedWin ? 'sfxWin' : res.merged ? 'sfxMerge' : 'sfxMove');
    if (res.state.over) audio.playSfx('sfxOver');
    commit({ state: res.state, best: Math.max(prev.best, res.state.score),
      newBest: prev.newBest || res.state.score > prev.best,
      event: { seq: (prev.event?.seq ?? 0) + 1, merged: res.merged, mergedTier: res.mergedTier,
        over: res.state.over, reachedWin: res.reachedWin, score: res.state.score } });
    return true;
  }, [audio, commit]);
  const restart = useCallback(() => {
    clearRun();
    commit({ state: newGame(freshSeed()), best: current.current.best, newBest: false, event: null });
  }, [commit]);
  const dismissWin = useCallback((keepPlaying: boolean) => {
    if (keepPlaying) commit({ ...current.current, state: { ...current.current.state, keepGoing: true } });
    else restart();
  }, [commit, restart]);
  return { ...run, showWin: run.state.won && !run.state.keepGoing, doMove, restart, dismissWin };
}
