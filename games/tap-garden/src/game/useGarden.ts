// React binding around the pure v2 garden logic. Keeps the authoritative state in
// a ref driven by a requestAnimationFrame passive-income + auto-tap loop, and
// mirrors it into React state (throttled) so the UI re-renders smoothly without a
// render per frame. Owns: selection/merge/move, pot taps + crits, all purchases
// (upgrades, plots, relics, rebirth), sound effects, a per-second aria-live dew
// value, pot bloom + crit cues, stage-clear toasts (chest + sfx_stage), the
// once-only Golden World Tree celebration, offline earnings on load, and autosave.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  hasEmptyPlot as hasSpace,
  mergeAll as mergeAllFn,
  toggleAutoMerge as toggleAutoMergeFn,
  newGame,
  derive,
  tap,
  buySeed,
  merge,
  move,
  tick,
  applyOffline,
  type GameState,
  type Derived,
} from './logic';
import { buyUpgrade as buyUpgradeFn, buyPlot as buyPlotFn } from './upgrades';
import { drawRelic as drawRelicFn, buyRelic as buyRelicFn, upgradeRelic as upgradeRelicFn } from './relics';
import { applyRebirth } from './rebirth';
import { loadSave, writeSave, clearSave } from './save';
import { MAX_LEVEL, SAVE_INTERVAL_MS, OFFLINE_MIN_SEC, PLOT_UNLOCK_ORDER, isPlotUnlocked } from './config';
import type { AudioManager } from '../platform/audio';

export type EventKind =
  | 'selected' | 'deselected' | 'moved' | 'merged' | 'bought'
  | 'plotBought' | 'needDew' | 'bulkMerged'
  | 'newMax' | 'full' | 'nothing' | 'freeSeed';

export interface GameEvent {
  seq: number;
  kind: EventKind;
  level?: number;
  plot?: number;
}

export interface StageToast {
  seq: number;
  stage: number;
  chest: number;
}

export interface TapOutcome {
  gained: number;
  crit: boolean;
}

export interface UpgradeOutcome {
  ok: boolean;
  bought: number;
}
export interface DrawOutcome {
  ok: boolean;
  index: number;
  newlyOwned: boolean;
  level: number;
}

export interface UseGarden {
  snap: GameState;
  d: Derived;
  selected: number | null;
  bloom: number;
  mergeAll: () => void;
  toggleAutoMerge: () => void;
  event: GameEvent | null;
  stageToast: StageToast | null;
  liveDew: number;
  offline: number | null;
  celebrate: boolean;
  tapPot: () => TapOutcome;
  buy: () => void;
  buyUpgrade: (index: number, mode: 'one' | 'max') => UpgradeOutcome;
  buyPlot: () => boolean;
  drawRelic: () => DrawOutcome;
  buyRelic: (index: number) => boolean;
  upgradeRelic: (index: number) => boolean;
  rebirth: () => { ok: boolean; coins: number };
  tapPlot: (i: number) => void;
  dismissOffline: () => void;
  dismissCelebrate: () => void;
  dismissStageToast: () => void;
  reset: () => void;
  saveNow: () => void;
}

const COMMIT_MS = 120;

export function useGarden(audio: AudioManager): UseGarden {
  const init = useMemo(() => {
    const saved = loadSave();
    if (!saved) return { state: newGame(), celebrated: false, offline: null as number | null };
    const elapsed = Math.max(0, (Date.now() - saved.savedAt) / 1000);
    let offline: number | null = null;
    let state = saved.state;
    if (saved.savedAt > 0 && elapsed > OFFLINE_MIN_SEC) {
      const res = applyOffline(state, elapsed);
      if (res.earned >= 1) {
        offline = res.earned;
        state = res.state;
      }
    }
    return { state, celebrated: saved.celebrated, offline };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gsRef = useRef<GameState>(init.state);
  const celebratedRef = useRef<boolean>(init.celebrated);
  const [snap, setSnap] = useState<GameState>(init.state);
  const [selected, setSelected] = useState<number | null>(null);
  const [bloom, setBloom] = useState(0);
  const [event, setEvent] = useState<GameEvent | null>(null);
  const [stageToast, setStageToast] = useState<StageToast | null>(null);
  const [liveDew, setLiveDew] = useState<number>(Math.floor(init.state.dew));
  const [offline, setOffline] = useState<number | null>(init.offline);
  const [celebrate, setCelebrate] = useState<boolean>(
    init.state.discovered >= MAX_LEVEL && !init.celebrated,
  );
  const seqRef = useRef(0);
  const stageSeqRef = useRef(0);
  const pendingStageRef = useRef<StageToast | null>(null);
  const shownStageSeqRef = useRef(0);

  const emit = useCallback((kind: EventKind, level?: number, plot?: number) => {
    seqRef.current += 1;
    setEvent({ seq: seqRef.current, kind, level, plot });
  }, []);

  const noteInfo = useCallback((info: { stageAdvanced: number; chestDew: number }, state: GameState) => {
    if (info.stageAdvanced > 0) {
      stageSeqRef.current += 1;
      pendingStageRef.current = { seq: stageSeqRef.current, stage: state.stage, chest: info.chestDew };
    }
  }, []);

  const commit = useCallback((next: GameState) => {
    gsRef.current = next;
    setSnap(next);
    writeSave(next, celebratedRef.current, Date.now());
  }, []);

  const maybeCelebrate = useCallback(() => {
    if (gsRef.current.discovered >= MAX_LEVEL && !celebratedRef.current) setCelebrate(true);
  }, []);

  // --- passive income + auto-tap loop -----------------------------------------
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.25) dt = 0.25;
      const previousMerges = gsRef.current.stats.merges;
      const res = tick(gsRef.current, dt);
      gsRef.current = res.state;
      const merged = res.state.stats.merges - previousMerges;
      if (merged > 0) {
        setSelected(null); setBloom(b => b + 1); audio.playSfx('sfxMerge');
        emit('bulkMerged', merged); maybeCelebrate();
      }
      if (res.info.stageAdvanced > 0) noteInfo(res.info, res.state);
      raf = requestAnimationFrame(frame);
    };
    const commitTimer = window.setInterval(() => {
      setSnap(gsRef.current);
      const pend = pendingStageRef.current;
      if (pend && pend.seq !== shownStageSeqRef.current) {
        shownStageSeqRef.current = pend.seq;
        setStageToast(pend);
        audio.playSfx('sfxStage');
        maybeCelebrate();
      }
    }, COMMIT_MS);
    const liveTimer = window.setInterval(() => setLiveDew(Math.floor(gsRef.current.dew)), 1000);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(commitTimer);
      window.clearInterval(liveTimer);
    };
  }, [audio, noteInfo, maybeCelebrate, emit]);

  // --- autosave ---------------------------------------------------------------
  const saveNow = useCallback(() => writeSave(gsRef.current, celebratedRef.current, Date.now()), []);
  useEffect(() => {
    const save = saveNow;
    const timer = window.setInterval(save, SAVE_INTERVAL_MS);
    const onHide = () => save();
    const onVis = () => {
      if (document.hidden) save();
    };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      save();
      window.clearInterval(timer);
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [saveNow]);

  // --- pot / plots ------------------------------------------------------------
  const tapPot = useCallback((): TapOutcome => {
    const res = tap(gsRef.current);
    commit(res.state);
    noteInfo(res.info, res.state);
    if (res.crit) {
      audio.playSfx('sfxCrit');
    } else {
      audio.playSfx('sfxTap');
    }
    return { gained: res.gained, crit: res.crit };
  }, [audio, commit, noteInfo]);

  const buy = useCallback(() => {
    const res = buySeed(gsRef.current);
    if (!res.ok) {
      emit(hasSpace(gsRef.current) ? 'needDew' : 'full');
      return;
    }
    commit(res.state);
    audio.playSfx('sfxBuy');
    emit('bought', res.level);
  }, [audio, commit, emit]);

  const tapPlot = useCallback(
    (i: number) => {
      const s = gsRef.current;
      if (!isPlotUnlocked(i, s.unlocked)) {
        if (PLOT_UNLOCK_ORDER[s.unlocked] !== i) { emit('nothing'); return; }
        const res = buyPlotFn(s);
        if (res.ok) { commit(res.state); audio.playSfx('sfxUpgrade'); emit('plotBought', undefined, i); }
        else emit('needDew');
        return;
      }
      const level = s.plots[i];
      if (selected === null) {
        if (level > 0) {
          setSelected(i);
          audio.playSfx('sfxTap');
          emit('selected', level);
        } else {
          emit('nothing');
        }
        return;
      }
      if (i === selected) {
        setSelected(null);
        emit('deselected');
        return;
      }
      if (level === 0) {
        const res = move(s, selected, i);
        setSelected(null);
        if (res.ok) {
          commit(res.state);
          audio.playSfx('sfxTap');
          emit('moved');
        }
        return;
      }
      if (level === s.plots[selected]) {
        const res = merge(s, selected, i);
        setSelected(null);
        if (!res.ok) {
          emit('nothing');
          return;
        }
        commit(res.state);
        noteInfo(res.info, res.state);
        setBloom((b) => b + 1);
        if (res.isNewMax && res.newLevel >= 5) audio.playSfx('sfxBig');
        else audio.playSfx('sfxMerge');
        if (res.isNewMax) {
          emit('newMax', res.newLevel, res.plot);
          maybeCelebrate();
        } else {
          emit('merged', res.newLevel, res.plot);
        }
        if (res.freeSeed) emit('freeSeed');
        return;
      }
      setSelected(i);
      audio.playSfx('sfxTap');
      emit('selected', level);
    },
    [audio, commit, emit, maybeCelebrate, noteInfo, selected],
  );

  // --- purchases --------------------------------------------------------------
  const buyUpgrade = useCallback(
    (index: number, mode: 'one' | 'max'): UpgradeOutcome => {
      const res = buyUpgradeFn(gsRef.current, index, mode);
      if (res.bought === 0) return { ok: false, bought: 0 };
      commit(res.state);
      audio.playSfx('sfxUpgrade');
      return { ok: true, bought: res.bought };
    },
    [audio, commit],
  );

  const buyPlot = useCallback((): boolean => {
    const res = buyPlotFn(gsRef.current);
    if (!res.ok) return false;
    commit(res.state);
    audio.playSfx('sfxUpgrade');
    return true;
  }, [audio, commit]);

  const drawRelic = useCallback((): DrawOutcome => {
    const res = drawRelicFn(gsRef.current);
    if (!res.ok) return { ok: false, index: -1, newlyOwned: false, level: 0 };
    commit(res.state);
    audio.playSfx('sfxDraw');
    return { ok: true, index: res.index, newlyOwned: res.newlyOwned, level: res.level };
  }, [audio, commit]);

  const buyRelic = useCallback(
    (index: number): boolean => {
      const res = buyRelicFn(gsRef.current, index);
      if (!res.ok) return false;
      commit(res.state);
      audio.playSfx('sfxBuy');
      return true;
    },
    [audio, commit],
  );

  const upgradeRelic = useCallback(
    (index: number): boolean => {
      const res = upgradeRelicFn(gsRef.current, index);
      if (!res.ok) return false;
      commit(res.state);
      audio.playSfx('sfxUpgrade');
      return true;
    },
    [audio, commit],
  );

  const rebirth = useCallback((): { ok: boolean; coins: number } => {
    const res = applyRebirth(gsRef.current);
    if (!res.ok) return { ok: false, coins: 0 };
    commit(res.state);
    setSelected(null);
    audio.playSfx('sfxRebirth');
    return { ok: true, coins: res.coins };
  }, [audio, commit]);

  const dismissOffline = useCallback(() => setOffline(null), []);
  const dismissStageToast = useCallback(() => setStageToast(null), []);

  const dismissCelebrate = useCallback(() => {
    celebratedRef.current = true;
    setCelebrate(false);
    writeSave(gsRef.current, true, Date.now());
  }, []);

  const reset = useCallback(() => {
    clearSave();
    const fresh = newGame();
    celebratedRef.current = false;
    gsRef.current = fresh;
    setSnap(fresh);
    setSelected(null);
    setCelebrate(false);
    setOffline(null);
    setStageToast(null);
    pendingStageRef.current = null;
    setLiveDew(0);
    emit('deselected');
  }, [emit]);

  const mergeAll = useCallback(() => {
    const result = mergeAllFn(gsRef.current);
    if (!result.merged) { emit('nothing'); return; }
    const cleared = result.state.stage - gsRef.current.stage;
    commit(result.state); setSelected(null); setBloom(b => b + 1);
    audio.playSfx('sfxMerge'); emit('bulkMerged', result.merged); maybeCelebrate();
    noteInfo({ stageAdvanced: cleared, chestDew: 0 }, result.state);
  }, [commit, emit, audio, maybeCelebrate, noteInfo]);
  const toggleAutoMerge = useCallback(() => commit(toggleAutoMergeFn(gsRef.current)), [commit]);
  const d = useMemo(() => derive(snap), [snap]);

  return {
    snap,
    mergeAll, toggleAutoMerge,
    d,
    selected,
    bloom,
    event,
    stageToast,
    liveDew,
    offline,
    celebrate,
    tapPot,
    buy,
    buyUpgrade,
    buyPlot,
    drawRelic,
    buyRelic,
    upgradeRelic,
    rebirth,
    tapPlot,
    dismissOffline,
    dismissCelebrate,
    dismissStageToast,
    reset,
    saveNow,
  };
}
