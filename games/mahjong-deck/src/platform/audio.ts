// WebAudio playback over preloaded buffers. The AudioContext is created up front
// (suspended) so decodeAudioData can run during the preload gate; it is resumed
// by the first user gesture. All playback reuses the decoded buffers.

import type { AudioKey } from '../config/assets';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<AudioKey, AudioBuffer>();
  private bgmSource: AudioBufferSourceNode | null = null;
  private muted = false;
  private bgmWanted = false;

  constructor() {
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  get available(): boolean {
    return this.ctx !== null;
  }

  /** Decode preloaded ArrayBuffers into AudioBuffers (best-effort per file). */
  async decode(raw: Partial<Record<AudioKey, ArrayBuffer | null>>): Promise<void> {
    if (!this.ctx) return;
    const entries = Object.entries(raw) as Array<[AudioKey, ArrayBuffer | null]>;
    await Promise.all(
      entries.map(async ([key, buf]) => {
        if (!buf) return;
        try {
          const decoded = await this.ctx!.decodeAudioData(buf.slice(0));
          this.buffers.set(key, decoded);
        } catch {
          /* leave missing → silent */
        }
      }),
    );
  }

  /** Resume on the enter gesture. */
  async resume(): Promise<void> {
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        /* ignore */
      }
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.01);
    }
    if (muted) this.stopBgm();
    else if (this.bgmWanted) this.startBgm();
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** Play a one-shot sfx. `gain` (0..1) attenuates it, e.g. a soft blocked-tap. */
  playSfx(key: AudioKey, gain = 1): void {
    if (!this.ctx || !this.master || this.muted) return;
    const buf = this.buffers.get(key);
    if (!buf) return;
    if (this.ctx.state === 'suspended') return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    if (gain >= 1) {
      src.connect(this.master);
    } else {
      const g = this.ctx.createGain();
      g.gain.value = Math.max(0, gain);
      src.connect(g).connect(this.master);
    }
    src.start();
  }

  startBgm(): void {
    this.bgmWanted = true;
    if (!this.ctx || !this.master || this.muted || this.bgmSource) return;
    const buf = this.buffers.get('bgm');
    if (!buf) return;
    if (this.ctx.state === 'suspended') return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(this.master);
    src.start();
    this.bgmSource = src;
  }

  stopBgm(): void {
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

  suspend(): void {
    if (this.ctx?.state === 'running') this.ctx.suspend().catch(() => {});
  }

  private onVisibility = () => {
    if (!this.ctx) return;
    if (document.hidden) {
      this.suspend();
    } else {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
        // restart bgm if it was wanted and got torn down
        if (this.bgmWanted && !this.muted && !this.bgmSource) this.startBgm();
      }
    }
  };

  dispose(): void {
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.stopBgm();
  }
}
