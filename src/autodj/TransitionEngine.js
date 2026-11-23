export class TransitionEngine {
  constructor(mixer, decks, onComplete) {
    this.mixer = mixer; this.decks = decks; this.onComplete = onComplete;
    this.timer = null; this.running = false; this.token = 0;
  }
  async transition(fromId, toId, seconds = 8) {
    if (this.running) return false;
    const from = this.decks[fromId], to = this.decks[toId];
    if (!from?.track || !to?.track) return false;
    this.running = true;
    const token = ++this.token;
    await this.mixer.resume();

    const fromBpm = from.track.bpm || 0;
    const toBpm = to.track.bpm || 0;
    let targetBpm = fromBpm;
    if (fromBpm && toBpm) {
      // Prefer direct tempo match; half/double-time is allowed when closer.
      const options = [toBpm, toBpm * 2, toBpm / 2].filter(v => v >= 65 && v <= 180);
      targetBpm = options.sort((a, b) => Math.abs(a - fromBpm) - Math.abs(b - fromBpm))[0] || toBpm;
      const rate = Math.max(.94, Math.min(1.06, targetBpm / toBpm));
      to.setRate(rate);
    } else {
      to.setRate(1);
    }

    // Start the incoming deck on its measured beat phase.
    const beatOffset = Number(to.track.beatOffset) || 0;
    to.setCurrentTime(beatOffset);
    this.mixer.setDeckSide(fromId, .001);
    await to.play();

    const beatSeconds = targetBpm ? 60 / targetBpm : 0;
    const duration = Math.max(5, Math.min(14, beatSeconds ? beatSeconds * 16 : seconds)) * 1000;
    const start = performance.now();
    const startValue = fromId === 'A' ? 0 : 1;
    const endValue = toId === 'A' ? 0 : 1;
    const step = now => {
      if (!this.running || token !== this.token) return;
      const p = Math.min(1, (now - start) / duration);
      // Smooth equal-power crossfade, with a bass handoff around the midpoint.
      const eased = p * p * (3 - 2 * p);
      this.mixer.setCrossfader(startValue + (endValue - startValue) * eased, .02);
      if (p < .5) {
        from.setEQ(0, -5 * (p * 2));
        to.setEQ(0, -5 * (1 - p * 2));
      } else {
        from.setEQ(0, -5 - 7 * ((p - .5) * 2));
        to.setEQ(0, -5 + 5 * ((p - .5) * 2));
      }
      if (p < 1) this.timer = requestAnimationFrame(step);
      else {
        from.stop();
        from.setEQ(0, 0);
        to.setEQ(0, 0);
        from.setRate(1);
        this.running = false;
        this.onComplete?.(fromId, toId);
      }
    };
    this.timer = requestAnimationFrame(step);
    return true;
  }
  cancel() {
    this.running = false;
    this.token++;
    if (this.timer) cancelAnimationFrame(this.timer);
    this.timer = null;
  }
}
