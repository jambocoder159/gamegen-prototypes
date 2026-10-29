// Small seedable PRNG (mulberry32). Deterministic for a given seed so the
// headless sim and the title demo are reproducible.

export type Rng = (() => number) & { state: () => number };

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const rng = function (): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Object.assign(rng, { state: () => a >>> 0 });
}
