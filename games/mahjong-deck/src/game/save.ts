// Versioned run storage. Reject the whole save if any field or invariant is bad.
import type { State } from './useGame';
import { getStage, STAGE_COUNT } from './layouts';
import { CARD_KEYS, type CardKey } from '../config/assets';
import { isFree } from './logic';
export const RUN_KEY = 'mahjong-deck.run';
const LIMIT = 48_000;
const integer = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const card = (v: unknown): v is CardKey => typeof v === 'string' && CARD_KEYS.includes(v as CardKey);
export function validateRun(value: unknown): State | null {
  if (!value || typeof value !== 'object') return null;
  const envelope = value as { version?: unknown; state?: unknown };
  if (envelope.version !== 1 || !envelope.state || typeof envelope.state !== 'object') return null;
  const s = envelope.state as State;
  if (!integer(s.stageIndex, 0, STAGE_COUNT - 1) || !integer(s.seed, 0, 0xffffffff) || !integer(s.shuffleCount, 1, 10000) ||
      !['playing', 'reward'].includes(s.phase) || !integer(s.hearts, 1, 5) || !integer(s.score, 0, 100000000) ||
      !integer(s.combo, 1, 5) || !integer(s.comboCardLeft, 0, 3) || typeof s.wildActive !== 'boolean') return null;
  const stage = getStage(s.stageIndex);
  if (!Array.isArray(s.tiles) || s.tiles.length !== stage.positions.length) return null;
  for (let id = 0; id < s.tiles.length; id++) {
    const t = s.tiles[id], p = stage.positions[id];
    if (!t || t.id !== id || t.x !== p.x || t.y !== p.y || t.z !== p.z || !integer(t.type, 0, stage.K - 1) || typeof t.removed !== 'boolean') return null;
  }
  if (s.tiles.filter(t => !t.removed).length % 2) return null;
  if (!Array.isArray(s.hand) || s.hand.length > 4 || new Set(s.hand.map(h => h?.type)).size !== s.hand.length ||
      s.hand.some(h => !h || !card(h.type) || !integer(h.count, 1, 100))) return null;
  if (!Array.isArray(s.removedOrder) || s.removedOrder.length % 2 || new Set(s.removedOrder).size !== s.removedOrder.length ||
      s.removedOrder.some(id => !integer(id, 0, s.tiles.length - 1) || !s.tiles[id].removed) ||
      s.removedOrder.length !== s.tiles.filter(t => t.removed).length) return null;
  if (s.selected !== null && (!integer(s.selected, 0, s.tiles.length - 1) || !isFree(s.tiles[s.selected], s.tiles))) return null;
  if (s.hint !== null && (!Array.isArray(s.hint) || s.hint.length !== 2 || s.hint[0] === s.hint[1] ||
      s.hint.some(id => !integer(id, 0, s.tiles.length - 1) || !isFree(s.tiles[id], s.tiles)) || s.tiles[s.hint[0]].type !== s.tiles[s.hint[1]].type)) return null;
  if (s.phase === 'reward') {
    if (s.stageIndex === STAGE_COUNT - 1 || s.tiles.some(t => !t.removed) || !Array.isArray(s.rewards) || s.rewards.length !== 3 || new Set(s.rewards).size !== 3 || s.rewards.some(c => !card(c))) return null;
  } else if (s.rewards !== null || s.tiles.every(t => t.removed)) return null;
  if (![s.shakeId, s.blockedTapSeq, s.cheer].every(v => integer(v, 0, 100000)) ||
      (s.blockedTapId !== null && !integer(s.blockedTapId, 0, s.tiles.length - 1))) return null;
  // Pick every field explicitly so unknown data is never copied into the run.
  return { phase: s.phase, stageIndex: s.stageIndex, seed: s.seed, shuffleCount: s.shuffleCount,
    tiles: s.tiles.map(({ id, x, y, z, type, removed }) => ({ id, x, y, z, type, removed })),
    hand: s.hand.map(({ type, count }) => ({ type, count })), hearts: s.hearts, score: s.score,
    selected: s.selected, hint: s.hint, combo: s.combo, comboCardLeft: s.comboCardLeft, wildActive: s.wildActive,
    rewards: s.rewards, removedOrder: [...s.removedOrder], shakeId: s.shakeId, blockedTapId: s.blockedTapId,
    blockedTapSeq: s.blockedTapSeq, cheer: s.cheer };
}
export function clearRun(): void { try { localStorage.removeItem(RUN_KEY); } catch { /* unavailable */ } }
export function loadRun(): State | null {
  try {
    const raw = localStorage.getItem(RUN_KEY);
    if (!raw) return null;
    const state = raw.length <= LIMIT ? validateRun(JSON.parse(raw)) : null;
    if (state) return state;
  } catch { /* malformed or unavailable */ }
  clearRun();
  return null;
}
export function saveRun(state: State): void {
  if (state.phase === 'victory' || state.phase === 'defeat') { clearRun(); return; }
  try {
    const raw = JSON.stringify({ version: 1, state });
    if (raw.length <= LIMIT) localStorage.setItem(RUN_KEY, raw);
  } catch { /* quota / private browsing */ }
}
