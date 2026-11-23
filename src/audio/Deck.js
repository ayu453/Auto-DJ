import { Effects } from './Effects.js';

export class Deck {
  constructor(id, engine) {
    this.id = id; this.engine = engine; this.context = engine.context;
    this.audio = new Audio(); this.audio.preload = 'auto';
    this.source = this.context.createMediaElementSource(this.audio);
    this.effects = new Effects(this.context);
    this.gain = this.context.createGain();
    this.timeStretch = engine.createTimeStretchNode();
    if (this.timeStretch) {
      this.audio.preservesPitch = false;
      this.audio.webkitPreservesPitch = false;
      this.source.connect(this.timeStretch);
      this.timeStretch.connect(this.effects.input);
    } else {
      this.audio.preservesPitch = true;
      this.source.connect(this.effects.input);
    }
    this.effects.connect(this.gain);
    this.gain.connect(engine.masterInput);
    this.track = null; this.url = null; this.playing = false;
    this.rate = 1;
    this.audio.addEventListener('play', () => { this.playing = true; });
    this.audio.addEventListener('pause', () => { this.playing = false; });
  }
  load(track) {
    this.stop();
    if (this.url) URL.revokeObjectURL(this.url);
    this.track = track;
    this.url = URL.createObjectURL(track.blob);
    this.audio.src = this.url; this.audio.load();
    this.setRate(1);
    this.setEQ(0, 0); this.setEQ(1, 0); this.setEQ(2, 0);
  }
  async play() {
    await this.engine.resume();
    if (!this.track) return;
    await this.audio.play();
  }
  pause() { this.audio.pause(); }
  stop() {
    this.audio.pause();
    try { this.audio.currentTime = 0; } catch {}
    this.setRate(1);
  }
  cue() { this.setCurrentTime(0); }
  setCurrentTime(value) {
    if (Number.isFinite(this.audio.duration)) this.audio.currentTime = Math.max(0, Math.min(this.audio.duration, value));
  }
  setEQ(band, value) { this.effects.setEQ(band, value); }
  setGain(value, ramp = .025) {
    this.gain.gain.setTargetAtTime(Math.max(0, value), this.context.currentTime, ramp);
  }
  setRate(value) {
    // Keep tempo moves conservative to protect audio quality and processor stability.
    this.rate = Math.max(.94, Math.min(1.06, Number(value) || 1));
    this.audio.playbackRate = this.rate;
    if (this.timeStretch) {
      this.timeStretch.playbackRate.setValueAtTime(this.rate, this.context.currentTime);
      this.timeStretch.pitch.setValueAtTime(1, this.context.currentTime);
      this.timeStretch.pitchSemitones.setValueAtTime(0, this.context.currentTime);
    }
  }
  get currentTime() { return this.audio.currentTime || 0; }
  get duration() { return this.audio.duration || this.track?.duration || 0; }
  get remaining() { return Math.max(0, this.duration - this.currentTime); }
  dispose() {
    this.stop();
    if (this.url) URL.revokeObjectURL(this.url);
    this.source.disconnect();
    if (this.timeStretch) this.timeStretch.disconnect();
    this.effects.disconnect(); this.gain.disconnect();
  }
}
