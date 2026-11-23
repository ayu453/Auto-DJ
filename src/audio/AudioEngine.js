export class AudioEngine {
  constructor() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) throw new Error('Web Audio API is not supported in this browser.');
    this.context = new Ctx();
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
  async resume() { if (this.context.state !== 'running') await this.context.resume(); }
  destroy() { if (this.context.state !== 'closed') return this.context.close(); }
}