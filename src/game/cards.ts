// The six ability cards: their stable id, image key and i18n keys. The actual
// effects run in useGame (they need the live board/hearts/score); this module is
// just the catalogue plus the small helpers that manage the hand and roll the
// seeded reward choices.

import { CARD_KEYS, cardImageKey, type CardKey, type ImageKey } from '../config/assets';
import type { PRNG } from './logic';

export type { CardKey };

export interface CardDef {
  key: CardKey;
  image: ImageKey;
  nameKey: string; // i18n key for the card name
  effectKey: string; // i18n key for the short effect text
}

export const CARDS: Record<CardKey, CardDef> = Object.fromEntries(
  CARD_KEYS.map((key) => [
    key,
    { key, image: cardImageKey(key), nameKey: `cards.${key}.name`, effectKey: `cards.${key}.effect` },
  ]),
) as Record<CardKey, CardDef>;

/** One stack in the player's hand. */
export interface HandCard {
  type: CardKey;
  count: number;
}

export const MAX_DISTINCT = 4; // at most four distinct card types shown

/** Starting hand (PLAN §3): one hint, one shuffle. */
export function startingHand(): HandCard[] {
  return [
    { type: 'hint', count: 1 },
    { type: 'shuffle', count: 1 },
  ];
}

/** Add one card to the hand, merging into an existing stack. Returns a new array. */
export function addCard(hand: HandCard[], type: CardKey): HandCard[] {
  const next = hand.map((h) => ({ ...h }));
  const existing = next.find((h) => h.type === type);
  if (existing) {
    existing.count += 1;
  } else if (next.length < MAX_DISTINCT) {
    next.push({ type, count: 1 });
  } else {
    // Hand full of distinct types — fold onto the smallest stack to avoid losing
    // the reward (rare; the reward roll prefers held types when the hand is full).
    let min = next[0];
    for (const h of next) if (h.count < min.count) min = h;
    min.count += 1;
  }
  return next;
}

/** Remove one card of `type`; returns a new array (or the same if none held). */
export function useCard(hand: HandCard[], type: CardKey): HandCard[] {
  const idx = hand.findIndex((h) => h.type === type && h.count > 0);
  if (idx < 0) return hand;
  const next = hand.map((h) => ({ ...h }));
  next[idx].count -= 1;
  if (next[idx].count <= 0) next.splice(idx, 1);
  return next;
}

export function hasCard(hand: HandCard[], type: CardKey): boolean {
  return hand.some((h) => h.type === type && h.count > 0);
}

/**
 * Roll three distinct reward cards (seeded). When the hand already holds the max
 * distinct types, only offer types already held so the pick always merges.
 */
export function rollRewards(hand: HandCard[], rng: PRNG): CardKey[] {
  let pool: CardKey[] =
    hand.length >= MAX_DISTINCT ? hand.map((h) => h.type) : [...CARD_KEYS];
  pool = [...new Set(pool)];
  // Fisher–Yates on a copy, then take up to three.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  return pool.slice(0, Math.min(3, pool.length));
}
