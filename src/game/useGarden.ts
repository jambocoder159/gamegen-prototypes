// React binding around the pure garden logic. Keeps the authoritative state in a
// ref driven by a requestAnimationFrame passive-income loop, and mirrors it into
// React state (throttled) so the UI re-renders smoothly without a render per
// frame. Owns: selection/merge/move, sound effects, a per-second aria-live dew
// value, pot "bloom" + floating-number cues, the once-only Golden World Tree
// celebration, offline earnings on load, and autosave.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  newGame,
  tap,
  buySeed,
  merge,
  move,
  upgradeTap,
  tick,
  offlineEarnings,
  incomePerSec,
  nextSeedCost,
  nextUpgradeCost,
  canBuySeed as canBuySeedFn,
  canUpgrade as canUpgradeFn,
  type GameState,
} from './logic';
import { loadSave, writeSave, clearSave } from './save';
import { MAX_LEVEL, SAVE_INTERVAL_MS } from '../config/config';
import type { AudioManager } from '../platform/audio';

export type EventKind =
  | 'selected'
  | 'deselected'
  | 'moved'
  | 'merged'
  | 'bought'
  | 'upgraded'
  | 'newMax'
  | 'full'
  | 'nothing';

export interface GameEvent {
  seq: number;
  kind: EventKind;
  level?: number;
  plot?: number; // plot that changed (for the merge pop / particles)
}

export interface UseGarden {
  snap: GameState;
  selected: number | null;
  seedCost: number;
  upgradeCost: number;
  canBuy: boolean;
  canUpgrade: boolean;
  rate: number; // dew per second
  bloom: number; // increments on a merge / level-up (pot frame 4)
  event: GameEvent | null;
  liveDew: number; // floored dew, refreshed ~1×/sec for aria-live
  offline: number | null; // offline earnings to greet with, or null
  celebrate: boolean; // show the Golden World Tree celebration
  tapPot: () => number; // returns dew gained (for the floating number)
  buy: () => void;
  upgrade: () => void;
  tapPlot: (i: number) => void;
  dismissOffline: () => void;
  dismissCelebrate: () => void;
  reset: () => void;
}

const COMMIT_MS = 120; // how often the passive-income loop refreshes the UI

export function useGarden(audio: AudioManager): UseGarden {
  // Initialise from a save (applying offline earnings) or a fresh garden.
  const init = useMemo(() => {
    const saved = loadSave();
    if (!saved) return { state: newGame(), celebrated: false, offline: null as number | null };
    const elapsed = Math.max(0, (Date.now() - saved.savedAt) / 1000);
    let offline: number | null = null;
    let state = saved.state;
    if (saved.savedAt > 0 && elapsed > 30) {
      const earned = offlineEarnings(state, elapsed);
      if (earned >= 1) {
        offline = earned;
        state = { ...state, dew: state.dew + earned };
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
  const [liveDew, setLiveDew] = useState<number>(Math.floor(init.state.dew));
  const [offline, setOffline] = useState<number | null>(init.offline);
  const [celebrate, setCelebrate] = useState<boolean>(
    init.state.maxLevel >= MAX_LEVEL && !init.celebrated,
  );
  const seqRef = useRef(0);

  const emit = useCallback((kind: EventKind, level?: number, plot?: number) => {
    seqRef.current += 1;
    setEvent({ seq: seqRef.current, kind, level, plot });
  }, []);

  const commit = useCallback((next: GameState) => {
    gsRef.current = next;
    setSnap(next);
  }, []);

  const maybeCelebrate = useCallback(() => {
    if (gsRef.current.maxLevel >= MAX_LEVEL && !celebratedRef.current) {
      setCelebrate(true);
    }
  }, []);

  // --- passive income loop (rAF, delta-timed, UI refresh throttled) -----------
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.25) dt = 0.25; // cap after a stall/background tab
      gsRef.current = tick(gsRef.current, dt);
      raf = requestAnimationFrame(frame);
    };
    // separate throttled committer so we don't setState every frame
    const commitTimer = window.setInterval(() => setSnap(gsRef.current), COMMIT_MS);
    const liveTimer = window.setInterval(() => setLiveDew(Math.floor(gsRef.current.dew)), 1000);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(commitTimer);
      window.clearInterval(liveTimer);
    };
  }, []);

  // --- autosave ---------------------------------------------------------------
  useEffect(() => {
    const save = () => writeSave(gsRef.current, celebratedRef.current, Date.now());
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
  }, []);

  // --- actions ----------------------------------------------------------------
  const tapPot = useCallback((): number => {
    const res = tap(gsRef.current);
    commit(res.state);
    audio.playSfx('sfxTap');
    return res.gained;
  }, [audio, commit]);

  const buy = useCallback(() => {
    const res = buySeed(gsRef.current);
    if (!res.ok) {
      emit('full');
      return;
    }
    commit(res.state);
    audio.playSfx('sfxBuy');
    emit('bought', 1);
  }, [audio, commit, emit]);

  const upgrade = useCallback(() => {
    const res = upgradeTap(gsRef.current);
    if (!res.ok) {
      emit('nothing');
      return;
    }
    commit(res.state);
    audio.playSfx('sfxUpgrade');
    emit('upgraded', res.state.tapLevel);
  }, [audio, commit, emit]);

  const tapPlot = useCallback(
    (i: number) => {
      const s = gsRef.current;
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
        // move the selected plant onto this empty plot
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
        // same level → merge
        const res = merge(s, selected, i);
        setSelected(null);
        if (!res.ok) {
          emit('nothing');
          return;
        }
        commit(res.state);
        setBloom((b) => b + 1);
        if (res.isNewMax && res.newLevel >= 5) audio.playSfx('sfxBig');
        else audio.playSfx('sfxMerge');
        if (res.isNewMax) {
          emit('newMax', res.newLevel, res.plot);
          maybeCelebrate();
        } else {
          emit('merged', res.newLevel, res.plot);
        }
        return;
      }
      // different plant → switch selection to it
      setSelected(i);
      audio.playSfx('sfxTap');
      emit('selected', level);
    },
    [audio, commit, emit, maybeCelebrate, selected],
  );

  const dismissOffline = useCallback(() => setOffline(null), []);

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
    setLiveDew(0);
    emit('deselected');
  }, [emit]);

  const rate = incomePerSec(snap);
  const seedCost = nextSeedCost(snap);
  const upgradeCost = nextUpgradeCost(snap);

  return {
    snap,
    selected,
    seedCost,
    upgradeCost,
    canBuy: canBuySeedFn(snap),
    canUpgrade: canUpgradeFn(snap),
    rate,
    bloom,
    event,
    liveDew,
    offline,
    celebrate,
    tapPot,
    buy,
    upgrade,
    tapPlot,
    dismissOffline,
    dismissCelebrate,
    reset,
  };
}
