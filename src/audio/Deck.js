import { Effects } from './Effects.js';

export class Deck {
  constructor(id, engine) {
    this.id = id; this.engine = engine; this.context = engine.context;
    this.audio = new Audio(); this.audio.preload = 'auto';
    this.source = this.context.createMediaElementSource(this.audio);
    this.effects = new Effects(this.context);
    this.gain = this.context.createGain();
    this.mediaGain = this.context.createGain();
    this.mediaGain.gain.value = 1;
    this.loopGain = this.context.createGain();
    this.loopGain.gain.value = 0;
    this.loopBuffer = null;
    this.loopSource = null;
    this.loopFadeTimer = null;
    this.loadToken = 0;
    this.timeStretch = engine.createTimeStretchNode();
    if (this.timeStretch) {
      this.audio.preservesPitch = false;
      this.audio.webkitPreservesPitch = false;
      this.source.connect(this.mediaGain);
      this.mediaGain.connect(this.timeStretch);
      this.timeStretch.connect(this.effects.input);
    } else {
      this.audio.preservesPitch = true;
      this.source.connect(this.mediaGain);
      this.mediaGain.connect(this.effects.input);
    }
    this.loopGain.connect(this.effects.input);
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
    this.loopBuffer = null;
    const token = ++this.loadToken;
    track.blob.arrayBuffer().then(data => this.context.decodeAudioData(data)).then(buffer => {
      if (token === this.loadToken) this.loopBuffer = buffer;
    }).catch(error => console.warn('Loop sampler unavailable for', track.name, error));
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
    this.stopLoop(0);
    this.setMediaLevel(1, .005);
    this.audio.pause();
    try { this.audio.currentTime = 0; } catch {}
    this.setRate(1);
  }
  cue() { this.setCurrentTime(0); }
  setCurrentTime(value) {
    if (Number.isFinite(this.audio.duration)) this.audio.currentTime = Math.max(0, Math.min(this.audio.duration, value));
  }
  setEQ(band, value) { this.effects.setEQ(band, value); }
  setMediaLevel(value, ramp = .025) {
    this.mediaGain.gain.setTargetAtTime(Math.max(0, Math.min(1, value)), this.context.currentTime, ramp);
  }
  startLoop(start, length, rate = 1, level = .72) {
    if (!this.loopBuffer || !(length > 0)) return false;
    this.stopLoop(0);
    const buffer = this.loopBuffer;
    const safeLength = Math.min(length, buffer.duration);
    const safeStart = Math.max(0, Math.min(buffer.duration - safeLength, start));
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = safeStart;
    source.loopEnd = safeStart + safeLength;
    source.playbackRate.value = Math.max(.5, Math.min(2, rate || 1));
    source.connect(this.loopGain);
    this.loopSource = source;
    this.loopGain.gain.setTargetAtTime(Math.max(0, Math.min(1, level)), this.context.currentTime, .015);
    source.start();
    return true;
  }
  stopLoop(ramp = .06) {
    if (this.loopFadeTimer) clearTimeout(this.loopFadeTimer);
    this.loopGain.gain.setTargetAtTime(0, this.context.currentTime, Math.max(.005, ramp));
    const source = this.loopSource;
    this.loopSource = null;
    if (source) {
      const delay = Math.max(30, ramp * 700);
      this.loopFadeTimer = setTimeout(() => {
        try { source.stop(); } catch {}
        try { source.disconnect(); } catch {}
      }, delay);
    }
  }
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
    this.stopLoop(0);
    this.source.disconnect();
    this.mediaGain.disconnect(); this.loopGain.disconnect();
    if (this.timeStretch) this.timeStretch.disconnect();
    this.effects.disconnect(); this.gain.disconnect();
  }
}
