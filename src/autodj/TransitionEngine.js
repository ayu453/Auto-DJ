export class TransitionEngine {
  constructor(mixer, decks, onComplete) {
    this.mixer = mixer; this.decks = decks; this.onComplete = onComplete;
    this.timer = null; this.running = false; this.token = 0;
  }
  async transition(fromId, toId, seconds = 8) {
    if (this.running) return false;
    const from = this.decks[fromId], to = this.decks[toId];
    if (!from?.track || !to?.track) return false;
    this.running = true; const token = ++this.token;
    await this.mixer.resume();
    this.mixer.setDeckSide(fromId, .001);
    await to.play();
    const duration = Math.max(3, Math.min(15, seconds)) * 1000;
    const start = performance.now(), startValue = fromId === 'A' ? 0 : 1, endValue = toId === 'A' ? 0 : 1;
    const step = now => {
      if (!this.running || token !== this.token) return;
      const p = Math.min(1, (now - start) / duration);
      const eased = p * p * (3 - 2 * p);
      this.mixer.setCrossfader(startValue + (endValue - startValue) * eased, .015);
      if (p < 1) this.timer = requestAnimationFrame(step);
      else {
        from.stop(); this.running = false;
        this.onComplete?.(fromId, toId);
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