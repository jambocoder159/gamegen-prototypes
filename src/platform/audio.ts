// WebAudio playback. A single (initially suspended) AudioContext is created
// during preload so audio can be decoded into buffers; it is resumed on the
// first user gesture. Playback reuses the preloaded buffers.

import type { AudioKey } from '../config/assets';

type WindowWithWebkit = Window & { webkitAudioContext?: typeof AudioContext };

class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private bgmSource: AudioBufferSourceNode | null = null;
  private muted = false;
  private bgmWanted = false;
  private hidden = false;

  getContext(): AudioContext {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as WindowWithWebkit).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  setBuffers(map: Map<string, AudioBuffer>): void {
    this.buffers = map;
  }

  async resume(): Promise<void> {
    const ctx = this.getContext();
    if (ctx.state !== 'running') {
      try {
        await ctx.resume();
      } catch {
        /* ignore */
      }
    }
  }

  play(key: AudioKey, volume = 0.6): void {
    if (this.muted) return;
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || ctx.state !== 'running') return;
    const buf = this.buffers.get(key);
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = volume;
    src.connect(g);
    g.connect(master);
    src.start();
    src.onended = () => {
      src.disconnect();
      g.disconnect();
    };
  }

  startBgm(volume = 0.4): void {
    this.bgmWanted = true;
    this.restartBgm(volume);
  }

  private restartBgm(volume = 0.4): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || ctx.state !== 'running') return;
    const buf = this.buffers.get('bgm_base');
    if (!buf) return;
    this.stopBgmSource();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = volume;
    src.connect(g);
    g.connect(master);
    src.start();
    this.bgmSource = src;
  }

  private stopBgmSource(): void {
    if (this.bgmSource) {
      try {
        this.bgmSource.stop();
      } catch {
        /* already stopped */
      }
      this.bgmSource.disconnect();
      this.bgmSource = null;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 1;
  }

  isMuted(): boolean {
    return this.muted;
  }

  // Pause all audio while the tab is hidden; restore on return.
  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    const ctx = this.ctx;
    if (!ctx) return;
    if (hidden) {
      if (ctx.state === 'running') ctx.suspend().catch(() => {});
    } else {
      if (ctx.state === 'suspended') {
        ctx.resume().then(() => {
          if (this.bgmWanted && !this.bgmSource) this.restartBgm();
        }).catch(() => {});
      }
    }
  }

  get isHidden(): boolean {
    return this.hidden;
  }
}

export const audio = new AudioManager();
