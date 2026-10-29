// WebAudio manager. A suspended AudioContext is created during preload so buffers
// can be decoded; the first user gesture resumes it and starts BGM. Mute persists.

import type { AudioKey } from '../config/assets';

const MUTE_KEY = 'noodle_night_muted';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private buffers = new Map<AudioKey, AudioBuffer>();
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmSource: AudioBufferSourceNode | null = null;
  private bgmStarted = false;
  private _muted = false;
  private hidden = false;

  constructor() {
    try {
      this._muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      this._muted = false;
    }
  }

  get muted(): boolean {
    return this._muted;
  }

  /** Create a (suspended) context and decode all available audio buffers. */
  async prepare(audioData: Record<string, ArrayBuffer | null>): Promise<void> {
    try {
      const Ctor =
        window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0.5;
      this.bgmGain.connect(this.masterGain);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.9;
      this.sfxGain.connect(this.masterGain);
      this.applyMuteGain();

      const entries = Object.entries(audioData) as [AudioKey, ArrayBuffer | null][];
      await Promise.all(
        entries.map(async ([key, buf]) => {
          if (!buf) return;
          try {
            // slice() because decodeAudioData detaches the buffer
            const decoded = await this.ctx!.decodeAudioData(buf.slice(0));
            this.buffers.set(key, decoded);
          } catch {
            /* leave this one silent */
          }
        }),
      );
    } catch {
      this.ctx = null;
    }
  }

  /** Resume on the enter gesture. */
  async resume(): Promise<void> {
    if (!this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
    } catch {
      /* ignore */
    }
  }

  private applyMuteGain(): void {
    if (this.masterGain && this.ctx) {
      const target = this._muted || this.hidden ? 0 : 1;
      this.masterGain.gain.setValueAtTime(target, this.ctx.currentTime);
    }
  }

  setMuted(m: boolean): void {
    this._muted = m;
    try {
      localStorage.setItem(MUTE_KEY, m ? '1' : '0');
    } catch {
      /* ignore */
    }
    this.applyMuteGain();
  }

  toggleMuted(): boolean {
    this.setMuted(!this._muted);
    return this._muted;
  }

  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    if (!this.ctx) return;
    this.applyMuteGain();
    try {
      if (hidden) {
        void this.ctx.suspend();
      } else if (!this._muted) {
        void this.ctx.resume();
      }
    } catch {
      /* ignore */
    }
  }

  playSfx(key: AudioKey): void {
    if (!this.ctx || !this.sfxGain) return;
    if (this._muted || this.hidden) return;
    const buf = this.buffers.get(key);
    if (!buf) return;
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.sfxGain);
      src.start();
    } catch {
      /* ignore */
    }
  }

  startBgm(): void {
    if (!this.ctx || !this.bgmGain || this.bgmStarted) return;
    const buf = this.buffers.get('bgm_base');
    if (!buf) return;
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(this.bgmGain);
      src.start();
      this.bgmSource = src;
      this.bgmStarted = true;
    } catch {
      /* ignore */
    }
  }

  dispose(): void {
    try {
      this.bgmSource?.stop();
    } catch {
      /* ignore */
    }
  }
}

export const audio = new AudioManager();
