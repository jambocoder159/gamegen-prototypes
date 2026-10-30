// React binding around the pure logic + levels. Holds the current level, board,
// the lifted (selected) slot, move count, win state and star rating; fires sound
// effects; exposes a transient "clear effect" and a cheer counter so the UI can
// animate a shelf clearing and the clerk cheering; persists progress on a win.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { applyMove, newGame, starsFor, undo as undoState, type GameState } from './logic';
import { getLevels, LEVEL_COUNT, type Level } from './levels';
import { loadProgress, saveProgress, recordWin, type Progress } from './progress';
import { GOODS_KEYS } from '../config/assets';
import type { AudioManager } from '../platform/audio';
import { clearRun, saveRun, type SavedRun } from './run';

export interface ClearFx {
  seq: number;
  shelf: number; // shelf index that cleared
  type: number; // goods type that was completed
}

export interface WinInfo {
  stars: number;
  moves: number;
  par: number;
}

export type EventKind = 'selected' | 'placed' | 'putDown' | 'cleared' | 'won' | 'nothing' | 'occupied';
export interface GameEvent {
  seq: number;
  kind: EventKind;
  name?: string; // goods key for the aria message
  moves?: number;
  stars?: number;
}

const CLEAR_FX_MS = 460;

export interface UseGame {
  levels: Level[];
  level: Level;
  state: GameState;
  selected: number | null;
  moves: number;
  win: WinInfo | null;
  progress: Progress;
  clearFx: ClearFx | null;
  cheer: number;
  event: GameEvent | null;
  invalidFx: { seq: number; slot: number } | null;
  tapSlot: (i: number) => void;
  undo: () => void;
  restart: () => void;
  gotoLevel: (levelNumber: number) => void;
  nextLevel: () => void;
  persist: () => void;
}

function nameOf(type: number): string {
  return GOODS_KEYS[type];
}

export function useGame(audio: AudioManager, startLevel: number, resume?: SavedRun): UseGame {
  const levels = useMemo(() => getLevels(), []);
  const [levelIndex, setLevelIndex] = useState(() =>
    Math.min(Math.max(1, startLevel), LEVEL_COUNT) - 1,
  );
  const level = levels[levelIndex];

  const makeState = useCallback((lv: Level) => newGame(lv.S, lv.K, lv.board), []);
  const [state, setState] = useState<GameState>(() => resume?.state ?? makeState(level));
  const [selected, setSelected] = useState<number | null>(() => resume?.selected ?? null);
  const [win, setWin] = useState<WinInfo | null>(null);
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [clearFx, setClearFx] = useState<ClearFx | null>(null);
  const [cheer, setCheer] = useState(0);
  const [event, setEvent] = useState<GameEvent | null>(null);
  const [invalidFx, setInvalidFx] = useState<{ seq: number; slot: number } | null>(null);
  const seqRef = useRef(0);
  const fxSeqRef = useRef(0);

  const emit = useCallback((kind: EventKind, extra?: Partial<GameEvent>) => {
    seqRef.current += 1;
    setEvent({ seq: seqRef.current, kind, ...extra });
  }, []);

  const resetTo = useCallback(
    (lv: Level) => {
      setState(makeState(lv));
      setSelected(null);
      setWin(null);
      setClearFx(null);
      setEvent(null);
      setInvalidFx(null);
      clearRun();
    },
    [makeState],
  );

  // auto-clear the transient clear effect
  useEffect(() => {
    if (!clearFx) return;
    const id = window.setTimeout(() => setClearFx(null), CLEAR_FX_MS);
    return () => window.clearTimeout(id);
  }, [clearFx]);

  useEffect(() => {
    if (!invalidFx) return;
    const id = window.setTimeout(() => setInvalidFx(null), 650);
    return () => window.clearTimeout(id);
  }, [invalidFx]);

  const persist = useCallback(() => {
    saveProgress(progress);
    if (win) clearRun();
    else saveRun({ level: level.number, state, selected });
  }, [progress, win, level.number, state, selected]);

  useEffect(() => {
    persist();
    window.addEventListener('pagehide', persist);
    document.addEventListener('visibilitychange', persist);
    return () => {
      window.removeEventListener('pagehide', persist);
      document.removeEventListener('visibilitychange', persist);
    };
  }, [persist]);

  const tapSlot = useCallback(
    (i: number) => {
      if (win) return;
      const b = state.board;
      const reject = (kind: 'nothing' | 'occupied') => {
        audio.playSfx('sfxNope', 0.35);
        emit(kind);
        fxSeqRef.current += 1;
        setInvalidFx({ seq: fxSeqRef.current, slot: i });
      };
      if (!Number.isInteger(i) || i < 0 || i >= b.length) { reject('nothing'); return; }
      if (selected === null) {
        if (b[i] !== null) {
          setSelected(i);
          audio.playSfx('sfxPick');
          emit('selected', { name: nameOf(b[i] as number) });
        } else {
          reject('nothing');
        }
        return;
      }
      if (i === selected) {
        const name = nameOf(b[i] as number);
        setSelected(null);
        audio.playSfx('sfxPick');
        emit('putDown', { name });
        return;
      }
      if (b[i] !== null) {
        reject('occupied');
        return;
      }
      // empty destination with an item lifted → move
      const movedType = b[selected] as number;
      const res = applyMove(state, selected, i);
      setSelected(null);
      if (!res.ok) return;
      setState({ ...state });
      if (res.cleared.length > 0 && res.clearedType !== null) {
        audio.playSfx('sfxClear');
        fxSeqRef.current += 1;
        setClearFx({ seq: fxSeqRef.current, shelf: res.cleared[0], type: res.clearedType });
        setCheer((c) => c + 1);
      } else {
        audio.playSfx('sfxPlace');
      }
      if (res.won) {
        const stars = starsFor(state.moves, level.par, level.budgets);
        audio.playSfx('sfxWin');
        setWin({ stars, moves: state.moves, par: level.par });
        setProgress((p) => recordWin(p, level.number, stars));
        setCheer((c) => c + 1);
        emit('won', { moves: state.moves, stars });
      } else if (res.cleared.length > 0 && res.clearedType !== null) {
        emit('cleared', { name: nameOf(res.clearedType) });
      } else {
        emit('placed', { name: nameOf(movedType) });
      }
    },
    [audio, emit, level, selected, state, win],
  );

  const undo = useCallback(() => {
    if (win) return;
    setSelected(null);
    if (undoState(state)) {
      setState({ ...state });
      audio.playSfx('sfxPick');
    }
  }, [audio, state, win]);

  const restart = useCallback(() => {
    resetTo(level);
    audio.playSfx('sfxClick');
  }, [audio, level, resetTo]);

  const gotoLevel = useCallback(
    (levelNumber: number) => {
      const idx = Math.min(Math.max(1, levelNumber), LEVEL_COUNT) - 1;
      setLevelIndex(idx);
      resetTo(levels[idx]);
    },
    [levels, resetTo],
  );

  const nextLevel = useCallback(() => {
    if (level.number < LEVEL_COUNT) gotoLevel(level.number + 1);
  }, [gotoLevel, level.number]);

  return {
    levels,
    level,
    state,
    selected,
    moves: state.moves,
    win,
    progress,
    clearFx,
    cheer,
    event,
    invalidFx,
    tapSlot,
    undo,
    restart,
    gotoLevel,
    nextLevel,
    persist,
  };
}
