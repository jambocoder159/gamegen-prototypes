// GameCanvas owns one running game: the pure GameSim, the DOM renderer, the
// fixed-timestep loop, input, and audio. React renders only the playfield
// container; everything inside is mutated imperatively per frame (no per-frame
// React state), so the simulation stays smooth.
//
// mode 'demo'  -> a CorridorBot plays, the game auto-restarts, no HUD, no sfx
// mode 'play'  -> pointer/keyboard input, HUD updates, sfx, reports game over

import { useEffect, useRef, type RefObject } from 'react';
import { GameSim, CorridorBot, FIXED_DT, type GameEvent } from '../game/logic';
import { GameRenderer } from '../game/renderer';
import { WORLD_H } from '../config/layout';
import type { Viewport } from '../platform/viewport';
import { audio } from '../platform/audio';
import type { AudioKey } from '../config/assets';

export interface GameResult {
  distance: number;
  sparks: number;
  score: number;
}

export interface HudRefs {
  distance: RefObject<HTMLSpanElement | null>;
  sparks: RefObject<HTMLSpanElement | null>;
  fuelFill: RefObject<HTMLDivElement | null>;
}

interface Props {
  mode: 'demo' | 'play';
  viewport: Viewport;
  images: Map<string, HTMLImageElement>;
  reducedMotion: boolean;
  seed?: number;
  paused?: boolean;
  playfieldLabel?: string;
  hud?: HudRefs;
  onOver?: (result: GameResult) => void;
  onTogglePause?: () => void;
}

const SFX: Record<GameEvent, AudioKey | null> = {
  collect: 'sfx_collect',
  fuel: 'sfx_fuel',
  hit: 'sfx_hit',
  over: 'sfx_over',
};

function xFracFor(vp: Viewport): number {
  return vp.mode === 'portrait' ? 0.28 : 0.3;
}

export function GameCanvas({
  mode,
  viewport,
  images,
  reducedMotion,
  seed = 1,
  paused = false,
  playfieldLabel,
  hud,
  onOver,
  onTogglePause,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  const vpRef = useRef(viewport);
  const sizeRef = useRef({ w: viewport.w, h: viewport.h });

  pausedRef.current = mode === 'play' ? paused : false;
  vpRef.current = viewport;

  // Keep the sim's view in sync with the viewport without restarting the loop.
  const simRef = useRef<GameSim | null>(null);
  useEffect(() => {
    sizeRef.current = { w: viewport.w, h: viewport.h };
    const sim = simRef.current;
    if (sim) sim.setView((WORLD_H * viewport.w) / viewport.h, xFracFor(viewport));
  }, [viewport]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const sim = new GameSim(seed);
    sim.setView((WORLD_H * vpRef.current.w) / vpRef.current.h, xFracFor(vpRef.current));
    sim.reset(seed);
    simRef.current = sim;

    const renderer = new GameRenderer(root, images, reducedMotion);
    const bot = mode === 'demo' ? new CorridorBot(0) : null;

    // --- Input (play mode) ---
    const pointers = new Set<number>();
    const heldKeys = new Set<string>();
    const holding = () => pointers.size > 0 || heldKeys.size > 0;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== undefined && e.button > 0) return;
      try {
        root.setPointerCapture(e.pointerId);
      } catch {
        /* capture unsupported */
      }
      pointers.add(e.pointerId);
    };
    const onPointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      try {
        root.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    };
    const MOVE_KEYS = new Set([' ', 'Spacebar', 'ArrowUp', 'w', 'W']);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        onTogglePause?.();
        return;
      }
      if (MOVE_KEYS.has(e.key)) {
        heldKeys.add(e.key);
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (MOVE_KEYS.has(e.key)) heldKeys.delete(e.key);
    };
    const clearKeys = () => heldKeys.clear();

    if (mode === 'play') {
      root.addEventListener('pointerdown', onPointerDown);
      root.addEventListener('pointerup', onPointerUp);
      root.addEventListener('pointercancel', onPointerUp);
      root.addEventListener('lostpointercapture', onPointerUp);
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', clearKeys);
    }

    // --- Loop ---
    let raf = 0;
    let last = 0;
    let acc = 0;
    let reported = false;
    let demoOverT = 0;
    let localSeed = seed >>> 0;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (last === 0) last = now;
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.25) dt = 0.25;

      if (!pausedRef.current) {
        acc += dt;
        let guard = 0;
        while (acc >= FIXED_DT && guard < 600) {
          const hold = bot ? bot.decide(sim, FIXED_DT) : holding();
          sim.step(FIXED_DT, hold);
          acc -= FIXED_DT;
          guard++;
          if (sim.over) break;
        }
      } else {
        acc = 0;
      }

      const { w, h } = sizeRef.current;
      renderer.render(sim, w, h);

      const events = sim.drainEvents();
      if (mode === 'play') {
        for (const ev of events) {
          const key = SFX[ev];
          if (key) audio.play(key, ev === 'over' ? 0.7 : 0.6);
        }
        if (hud) {
          const d = hud.distance.current;
          if (d) d.textContent = String(sim.distanceMeters());
          const s = hud.sparks.current;
          if (s) s.textContent = String(sim.sparksCollected);
          const f = hud.fuelFill.current;
          if (f) f.style.width = `${Math.max(0, Math.min(100, sim.lantern.fuel))}%`;
        }
      }

      if (sim.over) {
        if (mode === 'demo' && bot) {
          demoOverT += dt;
          if (demoOverT >= 1.1) {
            demoOverT = 0;
            localSeed = (Math.imul(localSeed, 1664525) + 1013904223) >>> 0;
            sim.reset(localSeed);
            bot.reset();
            acc = 0;
          }
        } else if (!reported) {
          reported = true;
          onOver?.({
            distance: sim.distanceMeters(),
            sparks: sim.sparksCollected,
            score: sim.score(),
          });
        }
      }
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      if (mode === 'play') {
        root.removeEventListener('pointerdown', onPointerDown);
        root.removeEventListener('pointerup', onPointerUp);
        root.removeEventListener('pointercancel', onPointerUp);
        root.removeEventListener('lostpointercapture', onPointerUp);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', clearKeys);
      }
      renderer.destroy();
      simRef.current = null;
    };
    // The loop is created once per mount; props it reads use refs. Remounting
    // (new key) starts a fresh game.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, seed]);

  return (
    <div
      ref={rootRef}
      className="lr-playfield"
      role={mode === 'play' ? 'application' : undefined}
      aria-label={mode === 'play' ? playfieldLabel : undefined}
      style={{ touchAction: 'none' }}
    />
  );
}
