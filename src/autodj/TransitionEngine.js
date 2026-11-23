export class TransitionEngine {
  constructor(mixer, decks, onComplete) {
    this.mixer = mixer; this.decks = decks; this.onComplete = onComplete;
    this.timer = null; this.running = false; this.token = 0;
  }

  // Snap the incoming cue to a four-beat bar using the analysed beat phase.
  alignedCue(track, requestedCue = 0) {
    const bpm = Number(track?.bpm) || 0;
    const beat = bpm ? 60 / bpm : Number(track?.beatInterval) || 0;
    const offset = Math.max(0, Number(track?.beatOffset) || 0);
    const intro = Math.max(0, Number(track?.structure?.introEnd) || 0);
    const requested = Math.max(requestedCue, intro);
    if (!beat) return requested;
    const bar = beat * 4;
    return offset + Math.max(0, Math.ceil((requested - offset) / bar)) * bar;
  }

  async transition(fromId, toId, seconds = 8, plan = { style: 'bass-swap' }) {
    if (this.running) return false;
    const from = this.decks[fromId], to = this.decks[toId];
    if (!from?.track || !to?.track || !from.playing) return false;
    this.running = true;
    const token = ++this.token;
    try {
      await this.mixer.resume();
      const outgoingBpm = Number(from.track.bpm) || 0;
      const incomingBpm = Number(to.track.bpm) || 0;
      const rate = outgoingBpm && incomingBpm ? outgoingBpm / incomingBpm : 1;
      const matched = rate >= .94 && rate <= 1.06;
      to.setRate(matched ? rate : 1);

      const requestedCue = Number(plan.incomingCue) || 0;
      const cue = this.alignedCue(to.track, requestedCue);
      to.setCurrentTime(cue);
      this.mixer.setDeckSide(fromId, .001);
      await to.play();
      if (!this.running || token !== this.token) { to.pause(); return false; }

      const bars = Math.max(4, Math.min(16, Number(plan.bars) || 8));
      const duration = Math.max(5, Math.min(18,
        outgoingBpm ? (60 / outgoingBpm) * 4 * bars : seconds)) * 1000;
      const start = performance.now();
      const startValue = fromId === 'A' ? 0 : 1;
      const endValue = toId === 'A' ? 0 : 1;
      const fxA = from.effects, fxB = to.effects;
      const filter = !!plan.filterSweep;
      const echo = Math.max(0, Math.min(.4, Number(plan.echo) || 0));

      // Existing sampler layer is left intact; Phase 2 will expand remix controls.
      const beatSeconds = outgoingBpm ? 60 / outgoingBpm : Number(from.track.beatInterval) || .5;
      const barSeconds = beatSeconds * 4;
      const elapsed = Math.max(0, from.currentTime - (Number(from.track.beatOffset) || 0));
      const loopBar = Math.max(0, Math.floor(elapsed / barSeconds) - 1);
      const loopStart = (Number(from.track.beatOffset) || 0) + loopBar * barSeconds;
      const loopStarted = plan.loopRepeat !== false && from.startLoop(loopStart, barSeconds, 1, .72);
      if (loopStarted) from.setMediaLevel(.48, .04);

      fxA.setEcho(echo); fxB.setEcho(0);
      fxA.setTransitionFilter(20); fxB.setTransitionFilter(filter ? 18000 : 20);

      const step = now => {
        if (!this.running || token !== this.token) return;
        const p = Math.min(1, (now - start) / duration);
        const eased = p * p * (3 - 2 * p);
        this.mixer.setCrossfader(startValue + (endValue - startValue) * eased, .02);
        if (plan.bassSwap) {
          if (p < .5) {
            from.setEQ(0, -12 * p);
            to.setEQ(0, -6 * (1 - p * 2));
          } else {
            from.setEQ(0, -6 - 12 * ((p - .5) * 2));
            to.setEQ(0, -6 + 6 * ((p - .5) * 2));
          }
        }
        if (filter) {
          fxA.setTransitionFilter(20 + 17980 * p);
          fxB.setTransitionFilter(18000 - 17980 * p);
        }
        if (echo) fxA.setEcho(echo * (1 - p));

        if (p < 1) this.timer = requestAnimationFrame(step);
        else {
          from.stopLoop(.025);
          from.setMediaLevel(1, .02);
          from.stop(); from.setEQ(0, 0); to.setEQ(0, 0); from.setRate(1);
          fxA.setEcho(0); fxB.setEcho(0);
          fxA.setTransitionFilter(20); fxB.setTransitionFilter(20);
          this.running = false;
          this.onComplete?.(fromId, toId, { matched, style: plan.style, plan, cue });
        }
      };
      this.timer = requestAnimationFrame(step);
      return true;
    } catch (error) {
      this.running = false;
      to.pause();
      to.setRate(1);
      throw error;
    }
  }

  cancel() {
    this.running = false; this.token++;
    if (this.timer) cancelAnimationFrame(this.timer);
    this.timer = null;
    for (const deck of Object.values(this.decks)) {
      deck.stopLoop(0); deck.setMediaLevel(1, .01);
    }
  }
}
