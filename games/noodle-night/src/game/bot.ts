// Title-screen autopilot. Drives a real GameState through the public action
// functions with human-like delays and an occasional mistake, and restarts the
// game when it loses. No sound, no HUD (the caller omits those).

import {
  type GameState,
  type Topping,
  TOPPINGS,
  toggleTopping,
  serve,
} from './logic';

export interface BotState {
  timer: number; // seconds until the next action
}

export function createBot(): BotState {
  return { timer: 0.7 };
}

function selected(state: GameState) {
  return state.customers.find((c) => c.id === state.selectedId && c.phase === 'ordering') ?? null;
}

function pick(arr: Topping[], r: number): Topping {
  return arr[Math.min(arr.length - 1, Math.floor(r * arr.length))];
}

// Advance the bot. `rnd` is a 0..1 source supplied by the caller so the demo stays
// deterministic-ish without pulling on the game's own RNG.
export function stepBot(state: GameState, bot: BotState, dt: number, rnd: () => number): void {
  if (state.status !== 'playing') return;
  bot.timer -= dt;
  if (bot.timer > 0) return;
  bot.timer = 0.6 + rnd() * 0.3; // 600–900 ms per action

  const c = selected(state);
  if (!c) return;

  const order = c.order;
  const extra = state.bowl.filter((t) => !order.includes(t));
  const missing = order.filter((t) => !state.bowl.includes(t));

  if (extra.length > 0) {
    // clean up a wrong topping
    toggleTopping(state, pick(extra, rnd()));
    return;
  }
  if (missing.length > 0) {
    toggleTopping(state, pick(missing, rnd()));
    return;
  }

  // bowl matches the order: usually serve, sometimes fumble (8%)
  const notInOrder = TOPPINGS.filter((t) => !order.includes(t));
  if (rnd() < 0.08 && notInOrder.length > 0 && state.bowl.length < 4) {
    toggleTopping(state, pick(notInOrder, rnd()));
    return;
  }
  serve(state);
}
