// React binding around the pure logic + stages. Owns the whole run: the tile
// stack, selection, hearts, score, the card hand and the ability-card effects,
// combo timing, the reward / victory / defeat phases, stuck detection with
// auto-reshuffle, fires sound effects and persists the best score.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  generateDeal,
  findMatch,
  hasMove,
  isFree,
  isWon,
  mulberry32,
  reshuffleTypes,
  type Tile,
} from './logic';
import { getStages, STAGE_COUNT, type Stage } from './layouts';
import {
  addCard,
  hasCard,
  rollRewards,
  startingHand,
  useCard as removeHandCard,
  type CardKey,
  type HandCard,
} from './cards';
import { loadBest, saveBest } from './progress';
import type { AudioManager } from '../platform/audio';

export type Phase = 'playing' | 'reward' | 'victory' | 'defeat';
export type NoticeKind =
  | 'match' | 'mismatch' | 'select' | 'stageClear'
  | 'reshuffleCard' | 'reshuffleHeart' | 'noPair'
  | 'cardHint' | 'cardShuffle' | 'cardUndo' | 'cardWild' | 'cardHeal' | 'cardCombo'
  | 'victory' | 'defeat' | 'heal';

export interface Notice {
  seq: number;
  kind: NoticeKind;
  n?: number;
}

export const START_HEARTS = 3;
export const MAX_HEARTS = 5;
export const COMBO_WINDOW_MS = 2500;
export const MAX_COMBO = 5;
const STAGE_CLEAR_BONUS = 200;

function dealSeed(stageIndex: number, salt: number): number {
  return (Math.imul(0x9e3779b1, stageIndex + 1) + Math.imul(salt, 0x85ebca77)) >>> 0;
}
function rewardSeed(stageIndex: number): number {
  return (Math.imul(0xc2b2ae35, stageIndex + 1) + 0x165667b1) >>> 0;
}

interface State {
  phase: Phase;
  stageIndex: number;
  tiles: Tile[];
  selected: number | null;
  hearts: number;
  score: number;
  hand: HandCard[];
  combo: number;
  comboCardLeft: number; // matches left with the combo card's ×2
  wildActive: boolean;
  hint: [number, number] | null;
  rewards: CardKey[] | null;
  removedOrder: number[]; // tile ids in the order they were removed (for undo)
  shakeId: number; // bumps to trigger a mismatch shake
  cheer: number; // bumps to make the dealer cheer
}

function makeStageTiles(stageIndex: number, salt: number): Tile[] {
  const stage = getStages()[stageIndex];
  // generateDeal only fails on a malformed layout; our layouts are verified, but
  // retry with a new salt just in case a particular PRNG tie-break strands.
  for (let s = salt; s < salt + 16; s++) {
    const tiles = generateDeal(stage.positions, stage.K, dealSeed(stageIndex, s));
    if (tiles) return tiles;
  }
  // Last resort: an un-typed stack (should never be reached).
  return stage.positions.map((p, id) => ({ ...p, id, type: 0, removed: false }));
}

function freshState(stageIndex: number): State {
  return {
    phase: 'playing',
    stageIndex,
    tiles: makeStageTiles(stageIndex, 0),
    selected: null,
    hearts: START_HEARTS,
    score: 0,
    hand: startingHand(),
    combo: 1,
    comboCardLeft: 0,
    wildActive: false,
    hint: null,
    rewards: null,
    removedOrder: [],
    shakeId: 0,
    cheer: 0,
  };
}

export interface UseGame {
  phase: Phase;
  stage: Stage;
  tiles: Tile[];
  selected: number | null;
  hearts: number;
  score: number;
  best: number;
  hand: HandCard[];
  combo: number;
  comboActive: boolean; // show the combo pill
  comboCardLeft: number;
  wildActive: boolean;
  hint: [number, number] | null;
  rewards: CardKey[] | null;
  shakeId: number;
  cheer: number;
  notice: Notice | null;
  tapTile: (id: number) => void;
  playCard: (type: CardKey) => void;
  chooseReward: (type: CardKey) => void;
  restart: () => void;
}

export function useGame(audio: AudioManager): UseGame {
  const stages = useMemo(() => getStages(), []);
  const [state, setState] = useState<State>(() => freshState(0));
  const [best, setBest] = useState<number>(loadBest);
  const [notice, setNotice] = useState<Notice | null>(null);

  const lastMatchRef = useRef<number>(-Infinity);
  const comboTimerRef = useRef<number>(0);
  const shuffleSaltRef = useRef<number>(1);
  const noticeSeq = useRef(0);

  const announce = useCallback((kind: NoticeKind, n?: number) => {
    noticeSeq.current += 1;
    setNotice({ seq: noticeSeq.current, kind, n });
  }, []);

  useEffect(() => () => window.clearTimeout(comboTimerRef.current), []);

  const now = useCallback(
    () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
    [],
  );

  const commitBest = useCallback((score: number) => {
    setBest((b) => {
      const next = saveBest(Math.max(b, score));
      return next;
    });
  }, []);

  const scheduleComboDecay = useCallback(() => {
    window.clearTimeout(comboTimerRef.current);
    comboTimerRef.current = window.setTimeout(() => {
      setState((s) => (s.combo > 1 ? { ...s, combo: 1 } : s));
    }, COMBO_WINDOW_MS + 60);
  }, []);

  // Core: attempt to clear a stage / finish the run after a successful match.
  const afterRemoval = useCallback(
    (s: State): State => {
      if (isWon(s.tiles)) {
        const bonus = s.hearts * STAGE_CLEAR_BONUS;
        const score = s.score + bonus;
        audio.playSfx('sfxClear');
        if (s.stageIndex >= STAGE_COUNT - 1) {
          audio.playSfx('sfxWin');
          commitBest(score);
          announce('victory');
          return { ...s, score, phase: 'victory', selected: null, hint: null, cheer: s.cheer + 1 };
        }
        const rng = mulberry32(rewardSeed(s.stageIndex));
        announce('stageClear', bonus);
        return {
          ...s,
          score,
          phase: 'reward',
          selected: null,
          hint: null,
          rewards: rollRewards(s.hand, rng),
          cheer: s.cheer + 1,
        };
      }
      // Not won — check for a stuck board and auto-reshuffle.
      if (!hasMove(s.tiles, s.wildActive)) {
        if (hasCard(s.hand, 'shuffle')) {
          const tiles = s.tiles.map((t) => ({ ...t }));
          reshuffleTypes(tiles, stages[s.stageIndex].K, dealSeed(s.stageIndex, shuffleSaltRef.current++));
          audio.playSfx('sfxCard');
          announce('reshuffleCard');
          return { ...s, tiles, hand: removeHandCard(s.hand, 'shuffle'), selected: null, hint: null };
        }
        const hearts = s.hearts - 1;
        if (hearts <= 0) {
          audio.playSfx('sfxLose');
          commitBest(s.score);
          announce('defeat');
          return { ...s, hearts: 0, phase: 'defeat', selected: null, hint: null };
        }
        const tiles = s.tiles.map((t) => ({ ...t }));
        reshuffleTypes(tiles, stages[s.stageIndex].K, dealSeed(s.stageIndex, shuffleSaltRef.current++));
        audio.playSfx('sfxWrong');
        announce('reshuffleHeart', hearts);
        return { ...s, tiles, hearts, selected: null, hint: null };
      }
      return s;
    },
    [audio, announce, commitBest, stages],
  );

  const tapTile = useCallback(
    (id: number) => {
      setState((s) => {
        if (s.phase !== 'playing') return s;
        const tile = s.tiles.find((t) => t.id === id);
        if (!tile || !isFree(tile, s.tiles)) return s;

        if (s.selected === null) {
          audio.playSfx('sfxSelect');
          return { ...s, selected: id, hint: null };
        }
        if (s.selected === id) {
          audio.playSfx('sfxSelect');
          return { ...s, selected: null, hint: null };
        }
        const first = s.tiles.find((t) => t.id === s.selected);
        if (!first) return { ...s, selected: id, hint: null };

        const match = s.wildActive || first.type === tile.type;
        if (!match) {
          audio.playSfx('sfxWrong');
          const hearts = s.hearts - 1;
          if (hearts <= 0) {
            audio.playSfx('sfxLose');
            commitBest(s.score);
            announce('defeat');
            return { ...s, hearts: 0, phase: 'defeat', selected: null, hint: null };
          }
          announce('mismatch', hearts);
          return { ...s, hearts, selected: null, shakeId: s.shakeId + 1, hint: null };
        }

        // Match → remove both, score with combo (+ combo-card ×2).
        const t = now();
        const combo = t - lastMatchRef.current <= COMBO_WINDOW_MS ? Math.min(MAX_COMBO, s.combo + 1) : 1;
        lastMatchRef.current = t;
        scheduleComboDecay();
        const mult = combo * (s.comboCardLeft > 0 ? 2 : 1);
        const gained = 100 * mult;
        const tiles = s.tiles.map((o) =>
          o.id === id || o.id === s.selected ? { ...o, removed: true } : { ...o },
        );
        audio.playSfx('sfxMatch');
        announce('match', gained);
        const next: State = {
          ...s,
          tiles,
          selected: null,
          score: s.score + gained,
          combo,
          comboCardLeft: Math.max(0, s.comboCardLeft - 1),
          wildActive: false,
          hint: null,
          removedOrder: [...s.removedOrder, s.selected, id],
          cheer: s.cheer + 1,
        };
        return afterRemoval(next);
      });
    },
    [audio, afterRemoval, announce, commitBest, now, scheduleComboDecay],
  );

  const playCard = useCallback(
    (type: CardKey) => {
      setState((s) => {
        if (s.phase !== 'playing' || !hasCard(s.hand, type)) return s;
        switch (type) {
          case 'hint': {
            const m = findMatch(s.tiles);
            if (!m) {
              announce('noPair');
              return s; // nothing to show → keep the card
            }
            audio.playSfx('sfxCard');
            announce('cardHint');
            return { ...s, hint: m, hand: removeHandCard(s.hand, 'hint'), selected: null };
          }
          case 'shuffle': {
            const tiles = s.tiles.map((t) => ({ ...t }));
            reshuffleTypes(tiles, stages[s.stageIndex].K, dealSeed(s.stageIndex, shuffleSaltRef.current++));
            audio.playSfx('sfxCard');
            announce('cardShuffle');
            return { ...s, tiles, hint: null, selected: null, hand: removeHandCard(s.hand, 'shuffle') };
          }
          case 'undo': {
            // Put the most recently removed pair back on the board.
            if (s.removedOrder.length < 2) {
              announce('noPair');
              return s;
            }
            const lastTwo = s.removedOrder.slice(-2);
            const tiles = s.tiles.map((t) =>
              lastTwo.includes(t.id) ? { ...t, removed: false } : { ...t },
            );
            audio.playSfx('sfxCard');
            announce('cardUndo');
            return {
              ...s,
              tiles,
              hint: null,
              selected: null,
              removedOrder: s.removedOrder.slice(0, -2),
              hand: removeHandCard(s.hand, 'undo'),
            };
          }
          case 'wild': {
            audio.playSfx('sfxCard');
            announce('cardWild');
            return { ...s, wildActive: true, hand: removeHandCard(s.hand, 'wild') };
          }
          case 'heal': {
            if (s.hearts >= MAX_HEARTS) {
              announce('noPair');
              return s;
            }
            audio.playSfx('sfxCard');
            announce('heal', s.hearts + 1);
            return { ...s, hearts: s.hearts + 1, hand: removeHandCard(s.hand, 'heal') };
          }
          case 'combo': {
            audio.playSfx('sfxCard');
            announce('cardCombo');
            return { ...s, comboCardLeft: 3, hand: removeHandCard(s.hand, 'combo') };
          }
          default:
            return s;
        }
      });
    },
    [audio, announce, stages],
  );

  const chooseReward = useCallback(
    (type: CardKey) => {
      setState((s) => {
        if (s.phase !== 'reward') return s;
        audio.playSfx('sfxCard');
        const hand = addCard(s.hand, type);
        const stageIndex = s.stageIndex + 1;
        lastMatchRef.current = -Infinity;
        shuffleSaltRef.current = 1;
        return {
          ...s,
          phase: 'playing',
          stageIndex,
          tiles: makeStageTiles(stageIndex, 0),
          selected: null,
          hand,
          combo: 1,
          comboCardLeft: s.comboCardLeft, // combo card persists across stages
          wildActive: false,
          hint: null,
          rewards: null,
          removedOrder: [],
        };
      });
    },
    [audio],
  );

  const restart = useCallback(() => {
    audio.playSfx('sfxClick');
    lastMatchRef.current = -Infinity;
    shuffleSaltRef.current = 1;
    window.clearTimeout(comboTimerRef.current);
    setState(freshState(0));
    setNotice(null);
  }, [audio]);

  return {
    phase: state.phase,
    stage: stages[state.stageIndex],
    tiles: state.tiles,
    selected: state.selected,
    hearts: state.hearts,
    score: state.score,
    best,
    hand: state.hand,
    combo: state.combo,
    comboActive: state.combo > 1,
    comboCardLeft: state.comboCardLeft,
    wildActive: state.wildActive,
    hint: state.hint,
    rewards: state.rewards,
    shakeId: state.shakeId,
    cheer: state.cheer,
    notice,
    tapTile,
    playCard,
    chooseReward,
    restart,
  };
}
