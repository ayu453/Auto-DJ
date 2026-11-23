import { Effects } from './Effects.js';
export class Deck {
  constructor(id, engine) {
    this.id = id; this.engine = engine; this.context = engine.context;
    this.audio = new Audio(); this.audio.preload = 'auto';
    this.source = this.context.createMediaElementSource(this.audio);
    this.effects = new Effects(this.context);
    this.gain = this.context.createGain();
    this.source.connect(this.effects.input);
    this.effects.connect(this.gain);
    this.gain.connect(engine.masterInput);
    this.track = null; this.url = null; this.playing = false;
    this.audio.addEventListener('play', () => { this.playing = true; });
    this.audio.addEventListener('pause', () => { this.playing = false; });
  }
  load(track) {
    this.stop();
    if (this.url) URL.revokeObjectURL(this.url);
    this.track = track;
    this.url = URL.createObjectURL(track.blob);
    this.audio.src = this.url; this.audio.load();
  }
  async play() { await this.engine.resume(); if (!this.track) return; await this.audio.play(); }
  pause() { this.audio.pause(); }
  stop() { this.audio.pause(); try { this.audio.currentTime = 0; } catch {} }
  cue() { this.setCurrentTime(0); }
  setCurrentTime(value) { if (Number.isFinite(this.audio.duration)) this.audio.currentTime = Math.max(0, Math.min(this.audio.duration, value)); }
  setEQ(band, value) { this.effects.setEQ(band, value); }
  setGain(value, ramp = .025) { this.gain.gain.setTargetAtTime(Math.max(0, value), this.context.currentTime, ramp); }
  setRate(value) { this.audio.playbackRate = Math.max(.8, Math.min(1.2, value)); }
  get currentTime() { return this.audio.currentTime || 0; }
  get duration() { return this.audio.duration || this.track?.duration || 0; }
  get remaining() { return Math.max(0, this.duration - this.currentTime); }
  dispose() { this.stop(); if (this.url) URL.revokeObjectURL(this.url); this.source.disconnect(); this.effects.disconnect(); this.gain.disconnect(); }
}