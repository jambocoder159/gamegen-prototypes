// Exact IDA*: shelves and positions within a shelf are interchangeable.
// A type needs at least 3 - (its largest group) relocations before clearing.
// This admissible lower bound plus exhaustive depth limits proves optimality.
export function optimalSolution(initial, upperBound) {
  const key = (board) => {
    const shelves = [];
    for (let s = 0; s < board.length; s += 3)
      shelves.push(board.slice(s, s + 3).map(v => v ?? -1).sort((a, b) => a - b).join(','));
    return shelves.sort().join('|');
  };
  const lowerBound = (board) => {
    const maxima = new Map();
    for (let s = 0; s < board.length; s += 3) {
      const counts = new Map();
      for (const v of board.slice(s, s + 3)) if (v !== null) counts.set(v, (counts.get(v) ?? 0) + 1);
      for (const [v, n] of counts) maxima.set(v, Math.max(maxima.get(v) ?? 0, n));
    }
    return [...maxima.values()].reduce((sum, n) => sum + 3 - n, 0);
  };
  const visit = (board, remaining, seen) => {
    if (board.every(v => v === null)) return [];
    if (lowerBound(board) > remaining || remaining === 0) return null;
    const signature = key(board);
    if ((seen.get(signature) ?? -1) >= remaining) return null;
    seen.set(signature, remaining);
    const candidates = [];
    for (let s = 0; s < board.length; s += 3) {
      const types = new Set();
      for (let from = s; from < s + 3; from++) {
        const type = board[from];
        if (type === null || types.has(type)) continue;
        types.add(type);
        const destinations = new Set();
        for (let d = 0; d < board.length; d += 3) {
          if (s === d) continue; // shuffling within a shelf cannot help
          const to = board.findIndex((v, i) => i >= d && i < d + 3 && v === null);
          if (to < 0) continue;
          const shape = board.slice(d, d + 3).map(v => v ?? -1).sort().join(',');
          if (destinations.has(shape)) continue;
          destinations.add(shape);
          const next = board.slice();
          next[to] = type;
          next[from] = null;
          if (next.slice(d, d + 3).every(v => v === type)) next.fill(null, d, d + 3);
          candidates.push({ from, to, next, h: lowerBound(next) });
        }
      }
    }
    candidates.sort((a, b) => a.h - b.h);
    for (const { from, to, next } of candidates) {
      const tail = visit(next, remaining - 1, seen);
      if (tail) return [{ from, to }, ...tail];
    }
    return null;
  };
  for (let depth = lowerBound(initial); depth <= upperBound; depth++) {
    const result = visit(initial, depth, new Map());
    if (result) return result;
  }
  return null;
}
