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

    const fromBpm = Number(from.track.bpm) || 0;
    const toBpm = Number(to.track.bpm) || 0;
    let matched = false;
    if (fromBpm && toBpm) {
      const rate = fromBpm / toBpm;
      if (rate >= .94 && rate <= 1.06) {
        to.setRate(rate);
        matched = true;
      } else {
        to.setRate(1);
      }
    } else {
      to.setRate(1);
    }

    // Both decks use their locally analysed beat phase. The incoming track starts
    // at its first detected beat; the outgoing deck is already at a phrase boundary.
    const beatOffset = Math.max(0, Number(to.track.beatOffset) || 0);
    to.setCurrentTime(beatOffset);
    this.mixer.setDeckSide(fromId, .001);
    await to.play();

    const beatSeconds = fromBpm ? 60 / fromBpm : 0;
    const duration = Math.max(5, Math.min(14, beatSeconds ? beatSeconds * 16 : seconds)) * 1000;
    const start = performance.now();
    const startValue = fromId === 'A' ? 0 : 1;
    const endValue = toId === 'A' ? 0 : 1;
    const step = now => {
      if (!this.running || token !== this.token) return;
      const p = Math.min(1, (now - start) / duration);
      const eased = p * p * (3 - 2 * p);
      this.mixer.setCrossfader(startValue + (endValue - startValue) * eased, .02);

      // Bass swap: clear space for the incoming kick, then restore the outgoing deck.
      if (p < .5) {
        from.setEQ(0, -6 * (p * 2));
        to.setEQ(0, -6 * (1 - p * 2));
      } else {
        from.setEQ(0, -6 - 12 * ((p - .5) * 2));
        to.setEQ(0, -6 + 6 * ((p - .5) * 2));
      }
      if (p < 1) this.timer = requestAnimationFrame(step);
      else {
        from.stop();
        from.setEQ(0, 0); to.setEQ(0, 0);
        from.setRate(1);
        this.running = false;
        this.onComplete?.(fromId, toId, { matched });
      }
    };
    this.timer = requestAnimationFrame(step);
    return true;
  }
  cancel() {
    this.running = false; this.token++;
    if (this.timer) cancelAnimationFrame(this.timer);
    this.timer = null;
  }
}
