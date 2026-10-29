// Deterministic RNG (mulberry32). The state is a uint32 carried inside the game
// state, so a given sequence of actions always plays out the same way in the UI,
// the title bot, the tests and the economy simulation.

export function nextRng(state: number): { rng: number; value: number } {
  const rng = (state + 0x6d2b79f5) | 0;
  let r = Math.imul(rng ^ (rng >>> 15), rng | 1);
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
  const value = ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  return { rng: rng >>> 0, value };
}

/** Pick a uniformly random element index in [0, n) and advance the RNG. */
export function pickIndex(state: number, n: number): { rng: number; index: number } {
  const { rng, value } = nextRng(state);
  return { rng, index: Math.min(n - 1, Math.floor(value * n)) };
}
