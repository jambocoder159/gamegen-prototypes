// Imperative DOM renderer for Lantern Rise.
//
// The game logic (GameSim) is pure; this module paints a frame of it using
// plain DOM nodes transformed with translate3d. Nodes are recycled through a
// small object pool per entity kind — no node is created or destroyed during
// steady-state play, and nothing is drawn to a canvas. React owns the layer
// containers; this renderer only mutates their pooled children each frame.

import { GameSim, CONFIG } from './logic';
import { DRAW, HILL } from './render';
import { WORLD_H } from '../config/layout';
import { CROW_FRAMES, LANTERN_FRAMES, type ImageKey } from '../config/assets';

// Fallback flat colours when an image failed to load (platform rule 2).
const PLACEHOLDER: Record<string, string> = {
  spark: '#f2c14e',
  flame: '#e8702a',
  crow: '#2b2350',
  storm: '#5b4b74',
  hill: '#223a5e',
  lantern: '#e9c591',
};

class Pool {
  private nodes: HTMLImageElement[] = [];
  private used = 0;
  constructor(
    private readonly layer: HTMLElement,
    private readonly className: string,
  ) {}

  begin(): void {
    this.used = 0;
  }

  next(): HTMLImageElement {
    let el = this.nodes[this.used];
    if (!el) {
      el = document.createElement('img');
      el.className = this.className;
      el.alt = '';
      el.setAttribute('aria-hidden', 'true');
      el.draggable = false;
      el.style.position = 'absolute';
      el.style.left = '0';
      el.style.top = '0';
      el.style.willChange = 'transform';
      this.layer.appendChild(el);
      this.nodes[this.used] = el;
    }
    if (el.style.display === 'none') el.style.display = '';
    this.used++;
    return el;
  }

  end(): void {
    for (let i = this.used; i < this.nodes.length; i++) {
      if (this.nodes[i].style.display !== 'none') this.nodes[i].style.display = 'none';
    }
  }
}

export interface RenderOptions {
  reducedMotion: boolean;
  showHud: boolean; // false for the title demo (no lantern tilt change, etc.)
}

export class GameRenderer {
  private readonly hillsLayer: HTMLElement;
  private readonly entityLayer: HTMLElement;
  private readonly lanternLayer: HTMLElement;
  private readonly lanternEl: HTMLImageElement;
  private readonly sparkPool: Pool;
  private readonly flamePool: Pool;
  private readonly crowPool: Pool;
  private readonly stormPool: Pool;
  private readonly hillPool: Pool;
  private readonly src = new Map<string, string>();

  constructor(
    root: HTMLElement,
    images: Map<string, HTMLImageElement>,
    private readonly reducedMotion: boolean,
  ) {
    for (const [k, img] of images) this.src.set(k, img.currentSrc || img.src);

    this.hillsLayer = makeLayer('lr-hills');
    this.entityLayer = makeLayer('lr-entities');
    this.lanternLayer = makeLayer('lr-lantern-layer');
    // Order: entities behind, hills (near parallax) in front, lantern on top.
    root.appendChild(this.entityLayer);
    root.appendChild(this.hillsLayer);
    root.appendChild(this.lanternLayer);

    this.sparkPool = new Pool(this.entityLayer, 'lr-spark');
    this.flamePool = new Pool(this.entityLayer, 'lr-flame');
    this.crowPool = new Pool(this.entityLayer, 'lr-crow');
    this.stormPool = new Pool(this.entityLayer, 'lr-storm');
    this.hillPool = new Pool(this.hillsLayer, 'lr-hill');

    this.lanternEl = document.createElement('img');
    this.lanternEl.className = 'lr-lantern';
    this.lanternEl.alt = '';
    this.lanternEl.setAttribute('aria-hidden', 'true');
    this.lanternEl.draggable = false;
    this.lanternEl.style.position = 'absolute';
    this.lanternEl.style.left = '0';
    this.lanternEl.style.top = '0';
    this.lanternEl.style.willChange = 'transform, opacity';
    this.lanternLayer.appendChild(this.lanternEl);
  }

  /** Remove the layers this renderer created (clean remount / StrictMode). */
  destroy(): void {
    this.entityLayer.remove();
    this.hillsLayer.remove();
    this.lanternLayer.remove();
  }

  private applyImg(el: HTMLImageElement, key: ImageKey | string, placeholder: string): void {
    const s = this.src.get(key);
    if (s) {
      if (el.src !== s) el.src = s;
      if (el.style.backgroundColor) el.style.backgroundColor = '';
    } else {
      if (el.getAttribute('src')) el.removeAttribute('src');
      el.style.backgroundColor = placeholder;
      el.style.borderRadius = '40%';
    }
  }

  render(sim: GameSim, widthPx: number, heightPx: number): void {
    const ppu = heightPx / WORLD_H; // pixels per world unit
    const sx = (wx: number) => (wx - sim.scrollX) * ppu;
    const sy = (wy: number) => wy * ppu;

    // --- Hills (mirrored seamless tiles, 0.15x parallax, aligned to ground) ---
    const tileW = HILL.worldHeight * HILL.aspect * ppu;
    const tileH = HILL.worldHeight * ppu;
    const topPx = (CONFIG.groundY - HILL.topOffset) * ppu;
    const scroll = sim.scrollX * ppu * HILL.parallax;
    this.hillPool.begin();
    if (tileW > 0.5) {
      const first = Math.floor(scroll / tileW);
      const count = Math.ceil(widthPx / tileW) + 2;
      for (let k = 0; k < count; k++) {
        const idx = first + k;
        const x = idx * tileW - scroll;
        const mirror = (idx & 1) === 1 ? -1 : 1;
        const el = this.hillPool.next();
        this.applyImg(el, 'deco_hills', PLACEHOLDER.hill);
        setSize(el, tileW, tileH);
        el.style.transform = `translate3d(${x}px,${topPx}px,0) scaleX(${mirror})`;
      }
    }
    this.hillPool.end();

    // --- Sparks ---
    this.sparkPool.begin();
    const sw = DRAW.spark.w * ppu;
    const sh = DRAW.spark.h * ppu;
    for (const s of sim.sparks) {
      if (s.taken) continue;
      const px = sx(s.x);
      if (px < -sw || px > widthPx + sw) continue;
      const el = this.sparkPool.next();
      this.applyImg(el, 'icon_spark', PLACEHOLDER.spark);
      setSize(el, sw, sh);
      el.style.transform = `translate3d(${px - sw / 2}px,${sy(s.y) - sh / 2}px,0)`;
    }
    this.sparkPool.end();

    // --- Flame drops ---
    this.flamePool.begin();
    const fw = DRAW.flame.w * ppu;
    const fh = DRAW.flame.h * ppu;
    for (const f of sim.flames) {
      if (f.taken) continue;
      const px = sx(f.x);
      if (px < -fw || px > widthPx + fw) continue;
      const el = this.flamePool.next();
      this.applyImg(el, 'icon_flame', PLACEHOLDER.flame);
      setSize(el, fw, fh);
      el.style.transform = `translate3d(${px - fw / 2}px,${sy(f.y) - fh / 2}px,0)`;
    }
    this.flamePool.end();

    // --- Crows (animated, face left) ---
    this.crowPool.begin();
    const cw = DRAW.crow.w * ppu;
    const ch = DRAW.crow.h * ppu;
    for (const c of sim.crows) {
      const px = sx(c.x);
      if (px < -cw || px > widthPx + cw) continue;
      const el = this.crowPool.next();
      this.applyImg(el, CROW_FRAMES[c.frame], PLACEHOLDER.crow);
      setSize(el, cw, ch);
      el.style.transform = `translate3d(${px - cw / 2}px,${sy(c.y) - ch / 2}px,0)`;
    }
    this.crowPool.end();

    // --- Storm clouds ---
    this.stormPool.begin();
    const tw = DRAW.storm.w * ppu;
    const th = DRAW.storm.h * ppu;
    for (const st of sim.storms) {
      const px = sx(st.x);
      if (px < -tw || px > widthPx + tw) continue;
      const el = this.stormPool.next();
      this.applyImg(el, 'deco_storm', PLACEHOLDER.storm);
      setSize(el, tw, th);
      el.style.transform = `translate3d(${px - tw / 2}px,${sy(st.y) - th / 2}px,0)`;
    }
    this.stormPool.end();

    // --- Lantern ---
    const l = sim.lantern;
    const lw = DRAW.lantern.w * ppu;
    const lh = DRAW.lantern.h * ppu;
    const frame = LANTERN_FRAMES[Math.floor(sim.time * 8) % LANTERN_FRAMES.length];
    this.applyImg(this.lanternEl, frame, PLACEHOLDER.lantern);
    setSize(this.lanternEl, lw, lh);
    const lx = (sim.lanternScreenX() - l.knockX) * ppu;
    const ly = sy(l.y);
    const rot = this.reducedMotion ? 0 : l.tilt;
    this.lanternEl.style.transform =
      `translate3d(${lx - lw / 2}px,${ly - lh / 2}px,0) rotate(${rot}rad)`;

    // Invulnerability feedback: blink normally, steady dimming under reduced motion.
    let opacity = 1;
    if (l.invuln > 0) {
      opacity = this.reducedMotion ? 0.55 : (Math.floor(sim.time * 12) % 2 === 0 ? 1 : 0.3);
    }
    if (this.lanternEl.style.opacity !== String(opacity)) {
      this.lanternEl.style.opacity = String(opacity);
    }
  }
}

function makeLayer(cls: string): HTMLElement {
  const el = document.createElement('div');
  el.className = cls;
  el.setAttribute('aria-hidden', 'true');
  el.style.position = 'absolute';
  el.style.left = '0';
  el.style.top = '0';
  el.style.width = '100%';
  el.style.height = '100%';
  el.style.pointerEvents = 'none';
  return el;
}

function setSize(el: HTMLElement, w: number, h: number): void {
  const ws = `${w.toFixed(1)}px`;
  const hs = `${h.toFixed(1)}px`;
  if (el.style.width !== ws) el.style.width = ws;
  if (el.style.height !== hs) el.style.height = hs;
}
