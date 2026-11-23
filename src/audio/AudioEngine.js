import { SoundTouchNode } from '@soundtouchjs/audio-worklet';
import processorUrl from '@soundtouchjs/audio-worklet/processor?url';

export class AudioEngine {
  constructor() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) throw new Error('Web Audio API is not supported in this browser.');
    this.context = new Ctx();
    this.workletReady = false;
    this.workletError = null;
    this.masterInput = this.context.createGain();
    this.compressor = this.context.createDynamicsCompressor();
    this.compressor.threshold.value = -8;
    this.compressor.knee.value = 10;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = .004;
    this.compressor.release.value = .18;
    this.masterInput.connect(this.compressor);
    this.compressor.connect(this.context.destination);
  }
  async initialize() {
    if (!this.context.audioWorklet || !window.isSecureContext) {
      this.workletError = new Error('AudioWorklet requires a secure context.');
      return false;
    }
    try {
      await SoundTouchNode.register(this.context, processorUrl);
      this.workletReady = true;
    } catch (error) {
      this.workletError = error;
      console.warn('Pitch-preserving worklet unavailable; using browser pitch preservation.', error);
    }
    return this.workletReady;
  }
  createTimeStretchNode() {
    if (!this.workletReady) return null;
    return new SoundTouchNode({ context: this.context });
  }
  async resume() {
    if (this.context.state !== 'running') await this.context.resume();
  }
  destroy() {
    if (this.context.state !== 'closed') return this.context.close();
  }
}
