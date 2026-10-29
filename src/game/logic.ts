// Lantern Rise — pure game simulation. No React, no DOM.
// Fixed-timestep updates (see step()); deterministic given a seed.
// Coordinates: world units, y increases downward. The visible height is always
// WORLD_H units; the visible width is passed in (viewW) and follows the
// viewport aspect, so wide screens see further ahead.

import { makeRng, type Rng } from './rng.ts';

export const FIXED_DT = 1 / 120;

export const CONFIG = {
  ceilingY: 78, // soft clamp near the top (keeps the lantern clear of the HUD)
  groundY: 594, // collision ground line (hill line)
  gravity: 520,
  thrust: 950,
  vyMin: -250, // fastest rise (up is negative)
  vyMax: 340, // fastest fall
  fuelMax: 100,
  fuelDrain: 15, // per second while thrusting
  sparkFuel: 9,
  sparkScore: 10,
  flameFuel: 35,
  lanternR: 21,
  sparkR: 20,
  flameR: 24,
  crowR: 30,
  stormR: 46,
  hitFuelCost: 35,
  hitKnockVy: 150, // downward velocity imposed on hit
  hitKnockX: 36, // backward screen offset (visual), eased back
  invulnTime: 1.4,
  speedStart: 150,
  speedCap: 320,
  speedRampTime: 180, // seconds to reach the speed cap
  // Corridor (passable band) — half-height shrinks with difficulty.
  corridorHalfStart: 128,
  corridorHalfEnd: 94,
  corridorRampTime: 150,
  centerMid: 310,
  centerAmp1: 96,
  centerAmp2: 34,
  centerWave1: 1150, // wavelength in world units
  centerWave2: 460,
  sparkSpacing: 100, // world units between trail sparks
  hazardMargin: 38, // gap between corridor edge and a hazard body
  hazardDensityStart: 0.14, // probability a spawn step adds a hazard
  hazardDensityEnd: 0.5,
  hazardDensityRampTime: 150,
  crowShare: 0.5, // of hazards, fraction that are crows
  crowSpeedMin: 90,
  crowSpeedMax: 170,
  crowBobAmp: 26,
  flameEveryX: 2600, // place a flame drop roughly every N world units
  spawnMarginFrac: 0.6, // extra look-ahead beyond the right edge (× viewW)
} as const;

export type EntityKind = 'spark' | 'flame' | 'crow' | 'storm';

export interface Spark {
  id: number;
  x: number;
  y: number;
  taken: boolean;
}
export interface Flame {
  id: number;
  x: number;
  y: number;
  taken: boolean;
}
export interface Crow {
  id: number;
  baseX: number; // world x without bob
  x: number;
  y: number;
  baseY: number;
  phase: number;
  vxRel: number; // extra leftward speed relative to the world
  frame: number;
  frameT: number;
  hit: boolean;
}
export interface Storm {
  id: number;
  x: number;
  y: number;
  hit: boolean;
}

export type GameEvent = 'collect' | 'fuel' | 'hit' | 'over';

export interface Lantern {
  y: number;
  vy: number;
  fuel: number;
  invuln: number; // seconds of invulnerability remaining
  knockX: number; // visual backward offset, eases to 0
  tilt: number; // visual tilt target from vy
}

export class GameSim {
  rng: Rng;
  seed: number;
  viewW = 720;
  lanternXFrac = 0.3;

  time = 0;
  scrollX = 0;
  speed: number = CONFIG.speedStart;
  over = false;

  lantern: Lantern = { y: 300, vy: 0, fuel: CONFIG.fuelMax, invuln: 0, knockX: 0, tilt: 0 };

  sparks: Spark[] = [];
  flames: Flame[] = [];
  crows: Crow[] = [];
  storms: Storm[] = [];

  sparksCollected = 0;
  deathCause = '';
  private nextId = 1;
  private nextSpawnX = 0;
  private lastFlameX = 0;
  events: GameEvent[] = [];

  // Seeded phases for the analytic corridor-centre wander.
  private p1 = 0;
  private p2 = 0;

  constructor(seed = 1) {
    this.seed = seed >>> 0;
    this.rng = makeRng(this.seed);
    this.reset(this.seed);
  }

  reset(seed = this.seed): void {
    this.seed = seed >>> 0;
    this.rng = makeRng(this.seed);
    this.time = 0;
    this.scrollX = 0;
    this.speed = CONFIG.speedStart;
    this.over = false;
    this.p1 = this.rng() * Math.PI * 2;
    this.p2 = this.rng() * Math.PI * 2;
    this.lantern = {
      y: this.centerYAt(this.lanternXFrac * this.viewW),
      vy: 0,
      fuel: CONFIG.fuelMax,
      invuln: 0,
      knockX: 0,
      tilt: 0,
    };
    this.sparks = [];
    this.flames = [];
    this.crows = [];
    this.storms = [];
    this.sparksCollected = 0;
    this.hits = 0;
    this.deathCause = '';
    this.nextId = 1;
    this.nextSpawnX = this.lanternXFrac * this.viewW + 160;
    this.lastFlameX = this.nextSpawnX;
    this.events = [];
    // Pre-fill the world so the first screen already has a trail.
    this.generateAhead();
  }

  setView(viewW: number, lanternXFrac: number): void {
    this.viewW = Math.max(240, viewW);
    this.lanternXFrac = lanternXFrac;
  }

  lanternScreenX(): number {
    return this.lanternXFrac * this.viewW;
  }

  lanternWorldX(): number {
    return this.scrollX + this.lanternScreenX();
  }

  /** Smooth analytic corridor centre at a given world x. */
  centerYAt(x: number): number {
    const c = CONFIG;
    const y =
      c.centerMid +
      c.centerAmp1 * Math.sin((x / c.centerWave1) * Math.PI * 2 + this.p1) +
      c.centerAmp2 * Math.sin((x / c.centerWave2) * Math.PI * 2 + this.p2);
    const lo = c.ceilingY + 70;
    const hi = c.groundY - 90;
    return Math.max(lo, Math.min(hi, y));
  }

  corridorHalf(): number {
    const c = CONFIG;
    const t = Math.min(1, this.time / c.corridorRampTime);
    return c.corridorHalfStart + (c.corridorHalfEnd - c.corridorHalfStart) * t;
  }

  private hazardDensity(): number {
    const c = CONFIG;
    const t = Math.min(1, this.time / c.hazardDensityRampTime);
    return c.hazardDensityStart + (c.hazardDensityEnd - c.hazardDensityStart) * t;
  }

  private speedNow(): number {
    const c = CONFIG;
    const t = Math.min(1, this.time / c.speedRampTime);
    return c.speedStart + (c.speedCap - c.speedStart) * t;
  }

  private generateAhead(): void {
    const c = CONFIG;
    const rightEdge = this.scrollX + this.viewW + this.viewW * c.spawnMarginFrac;
    while (this.nextSpawnX < rightEdge) {
      const x = this.nextSpawnX;
      const cy = this.centerYAt(x);

      // Flame drop on long stretches, placed on the trail (reachable).
      if (x - this.lastFlameX >= c.flameEveryX) {
        this.flames.push({ id: this.nextId++, x, y: cy, taken: false });
        this.lastFlameX = x;
      } else {
        this.sparks.push({ id: this.nextId++, x, y: cy, taken: false });
      }

      // Maybe add a hazard. Crows are placed so that at the moment they cross
      // the lantern's x they sit just OUTSIDE the corridor band; storms are
      // static, so the band centre at their x is already the reference.
      if (this.rng() < this.hazardDensity()) {
        const half = this.corridorHalf();
        const above = this.rng() < 0.5;
        const isCrow = this.rng() < c.crowShare;
        const r = isCrow ? c.crowR : c.stormR;
        const offset = half + c.hazardMargin + r;
        const lo = c.ceilingY + r;
        const hi = c.groundY - r;

        if (isCrow) {
          const vx = c.crowSpeedMin + this.rng() * (c.crowSpeedMax - c.crowSpeedMin);
          const lwx = this.scrollX + this.lanternScreenX();
          // Time for the crow (world x decreasing at vx) to meet the lantern
          // (world x increasing at ~speed); then the band centre at that x.
          const tCross = (x - lwx) / (this.speed + vx);
          const crossX = tCross > 0 ? lwx + this.speed * tCross : x;
          const refY = this.centerYAt(crossX);
          let hy = above ? refY - offset : refY + offset;
          if (hy < lo || hy > hi) hy = above ? refY + offset : refY - offset;
          if (hy >= lo && hy <= hi) {
            this.crows.push({
              id: this.nextId++,
              baseX: x,
              x,
              y: hy,
              baseY: hy,
              phase: this.rng() * Math.PI * 2,
              vxRel: vx,
              frame: (this.rng() * 4) | 0,
              frameT: 0,
              hit: false,
            });
          }
        } else {
          let hy = above ? cy - offset : cy + offset;
          if (hy < lo || hy > hi) hy = above ? cy + offset : cy - offset;
          if (hy >= lo && hy <= hi && Math.abs(hy - cy) > half + r * 0.5) {
            this.storms.push({ id: this.nextId++, x, y: hy, hit: false });
          }
        }
      }

      this.nextSpawnX += c.sparkSpacing;
    }
  }

  private cull(): void {
    const leftX = this.scrollX - 160;
    if (this.sparks.length) this.sparks = this.sparks.filter((s) => !s.taken && s.x > leftX);
    if (this.flames.length) this.flames = this.flames.filter((f) => !f.taken && f.x > leftX);
    if (this.crows.length) this.crows = this.crows.filter((c) => c.x > leftX);
    if (this.storms.length) this.storms = this.storms.filter((s) => s.x > leftX);
  }

  /** Advance the simulation by one fixed step. `holding` = thrust input. */
  step(dt: number, holding: boolean): void {
    if (this.over) return;
    const c = CONFIG;
    this.time += dt;
    this.speed = this.speedNow();
    this.scrollX += this.speed * dt;

    const l = this.lantern;

    // Thrust / gravity.
    const thrusting = holding && l.fuel > 0;
    if (thrusting) {
      l.vy -= c.thrust * dt;
      l.fuel = Math.max(0, l.fuel - c.fuelDrain * dt);
    }
    l.vy += c.gravity * dt;
    if (l.vy < c.vyMin) l.vy = c.vyMin;
    if (l.vy > c.vyMax) l.vy = c.vyMax;
    l.y += l.vy * dt;

    // Ceiling soft clamp (no death).
    const ceil = c.ceilingY + c.lanternR;
    if (l.y < ceil) {
      l.y = ceil;
      if (l.vy < 0) l.vy *= 0.25;
    }

    // Visual knockback easing & tilt.
    if (l.knockX > 0) l.knockX = Math.max(0, l.knockX - 150 * dt);
    const tiltTarget = Math.max(-0.5, Math.min(0.5, l.vy / 520));
    l.tilt += (tiltTarget - l.tilt) * Math.min(1, dt * 10);

    if (l.invuln > 0) l.invuln = Math.max(0, l.invuln - dt);

    // Update crows (fly left relative to world + sinusoidal bob).
    for (const crow of this.crows) {
      crow.baseX -= crow.vxRel * dt;
      crow.x = crow.baseX;
      crow.phase += dt * 3.2;
      crow.y = crow.baseY + Math.sin(crow.phase) * c.crowBobAmp;
      crow.frameT += dt;
      if (crow.frameT >= 0.1) {
        crow.frameT -= 0.1;
        crow.frame = (crow.frame + 1) & 3;
      }
    }

    this.generateAhead();

    // Collisions & pickups.
    const lx = this.lanternWorldX();
    const ly = l.y;

    for (const s of this.sparks) {
      if (s.taken) continue;
      if (dist2(lx, ly, s.x, s.y) <= sq(c.lanternR + c.sparkR)) {
        s.taken = true;
        l.fuel = Math.min(c.fuelMax, l.fuel + c.sparkFuel);
        this.sparksCollected++;
        this.events.push('collect');
      }
    }
    for (const f of this.flames) {
      if (f.taken) continue;
      if (dist2(lx, ly, f.x, f.y) <= sq(c.lanternR + c.flameR)) {
        f.taken = true;
        l.fuel = Math.min(c.fuelMax, l.fuel + c.flameFuel);
        this.events.push('fuel');
      }
    }

    if (l.invuln <= 0) {
      for (const crow of this.crows) {
        if (crow.hit) continue;
        if (dist2(lx, ly, crow.x, crow.y) <= sq(c.lanternR + c.crowR)) {
          crow.hit = true;
          this.applyHit();
          break;
        }
      }
    }
    if (l.invuln <= 0) {
      for (const st of this.storms) {
        if (st.hit) continue;
        if (dist2(lx, ly, st.x, st.y) <= sq(c.lanternR + c.stormR)) {
          st.hit = true;
          this.applyHit();
          break;
        }
      }
    }

    // Ground death.
    if (l.y + c.lanternR >= c.groundY) {
      l.y = c.groundY - c.lanternR;
      this.endGame('ground');
    }

    this.cull();
  }

  private applyHit(): void {
    const c = CONFIG;
    const l = this.lantern;
    l.fuel = Math.max(0, l.fuel - c.hitFuelCost);
    l.vy = Math.max(l.vy, c.hitKnockVy);
    l.knockX = c.hitKnockX;
    l.invuln = c.invulnTime;
    this.hits++;
    this.events.push('hit');
  }

  hits = 0;

  private endGame(cause: string): void {
    if (this.over) return;
    this.over = true;
    this.deathCause = cause;
    this.events.push('over');
  }

  distanceMeters(): number {
    return Math.floor(this.scrollX / 10);
  }

  score(): number {
    return this.distanceMeters() + this.sparksCollected * CONFIG.sparkScore;
  }

  drainEvents(): GameEvent[] {
    if (this.events.length === 0) return EMPTY_EVENTS;
    const e = this.events;
    this.events = [];
    return e;
  }
}

const EMPTY_EVENTS: GameEvent[] = [];

function sq(x: number): number {
  return x * x;
}
function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

// ---------------------------------------------------------------------------
// Corridor-following bot (used by the title demo and the headless sim).
// Reads a (possibly delayed) perception of the lantern and the corridor centre
// and holds thrust when it needs to rise.
// ---------------------------------------------------------------------------

interface Percept {
  t: number;
  y: number;
  vy: number;
  target: number;
}

// Switching-curve controller for the double-integrator lantern. The desired
// vertical speed is the fastest speed from which we can still brake to a stop
// exactly at the corridor centre (sqrt curve), so it never overshoots. With
// zero delay this tracks the centre tightly (collects the whole spark trail
// and never flies into the ground); a reaction delay makes it overshoot like a
// human, which is what makes the 150 ms bot die.
export class CorridorBot {
  private delay: number;
  private buf: Percept[] = [];
  private t = 0;
  // Conservative braking accelerations (a bit below the true values for margin).
  private readonly brakeDown = (CONFIG.thrust - CONFIG.gravity) * 0.82; // slowing a fall
  private readonly brakeUp = CONFIG.gravity * 0.82; // slowing a rise

  constructor(reactionDelaySec = 0) {
    this.delay = reactionDelaySec;
  }

  reset(): void {
    this.buf = [];
    this.t = 0;
  }

  decide(sim: GameSim, dt: number): boolean {
    this.t += dt;
    const target = sim.centerYAt(sim.lanternWorldX());
    this.buf.push({ t: this.t, y: sim.lantern.y, vy: sim.lantern.vy, target });
    const wantT = this.t - this.delay;
    while (this.buf.length > 1 && this.buf[1].t <= wantT) this.buf.shift();
    const p = this.buf[0];
    const err = p.target - p.y; // >0 means centre is below us: we should descend
    let vyDes: number;
    if (err > 0) {
      vyDes = Math.min(CONFIG.vyMax, Math.sqrt(2 * this.brakeDown * err));
    } else {
      vyDes = -Math.min(-CONFIG.vyMin, Math.sqrt(2 * this.brakeUp * -err));
    }
    // Hold (thrust up) when we are moving down faster than the safe speed.
    return p.vy > vyDes;
  }
}
