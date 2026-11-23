export class TransitionEngine {
  constructor(mixer, decks, onComplete) {
    this.mixer = mixer; this.decks = decks; this.onComplete = onComplete;
    this.timer = null; this.running = false; this.token = 0; this.vocalProtection = true;
  }

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
    let loopStarted = false;
    try {
      await this.mixer.resume();
      const outgoingBpm = Number(from.track.bpm) || 0;
      const incomingBpm = Number(to.track.bpm) || 0;
      const rate = outgoingBpm && incomingBpm ? outgoingBpm / incomingBpm : 1;
      const matched = rate >= .94 && rate <= 1.06;
      to.setRate(matched ? rate : 1);

      const cue = this.alignedCue(to.track, Number(plan.incomingCue) || 0);
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
      const beatSeconds = outgoingBpm ? 60 / outgoingBpm : Number(from.track.beatInterval) || .5;
      const loopBeats = Math.max(.25, Math.min(4, Number(plan.loopBeats) || 4));
      const loopBars = Math.max(1, Math.min(2, Number(plan.loopBars) || 2));
      const loopLength = beatSeconds * loopBeats;
      const barSeconds = beatSeconds * 4;
      const offset = Number(from.track.beatOffset) || 0;
      const elapsedBeats = Math.max(0, (from.currentTime - offset) / beatSeconds);
      const alignedBeat = Math.max(0, Math.floor(elapsedBeats));
      const loopStart = offset + Math.max(0, alignedBeat - loopBeats) * beatSeconds;

      // A short, quantized remix layer plays over the original track, then exits cleanly.
      loopStarted = plan.loopRepeat !== false && !from.stemMixer?.active &&
        from.startLoop(loopStart, loopLength, 1, plan.remix === 'beat-roll' ? .82 : .7);
      const remixDuration = Math.min(duration, beatSeconds * 4 * loopBars * 1000);
      let remixEnded = !loopStarted;
      if (loopStarted) from.setMediaLevel(.52, .035);

      fxA.setEcho(echo); fxB.setEcho(0);
      fxA.setTransitionFilter(20); fxB.setTransitionFilter(filter ? 18000 : 20);

      let vocalClashes = 0;
      const step = now => {
        if (!this.running || token !== this.token) return;
        const elapsedMs = now - start;
        const p = Math.min(1, elapsedMs / duration);
        const outgoingVoice = from.stemMixer?.hasVocals && from.stemMixer.isVocalActive(from.currentTime);
        const incomingVoice = to.stemMixer?.hasVocals && to.stemMixer.isVocalActive(to.currentTime);
        const clash = this.vocalProtection && outgoingVoice && incomingVoice;
        if (clash) { vocalClashes++; to.stemMixer.setAutoDuck(.12); } else to.stemMixer?.setAutoDuck(1);
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
          const rise = plan.remix === 'build-up' ? Math.min(1, p * 1.7) : p;
          fxA.setTransitionFilter(20 + 17980 * rise);
          fxB.setTransitionFilter(18000 - 17980 * p);
        }
        if (echo) fxA.setEcho(echo * (1 - p));

        if (!remixEnded && elapsedMs >= remixDuration) {
          from.stopLoop(.035);
          from.setMediaLevel(1, .035);
          remixEnded = true;
        }

        if (p < 1) this.timer = requestAnimationFrame(step);
        else {
          if (loopStarted && !remixEnded) from.stopLoop(.025);
          from.setMediaLevel(1, .02);
          from.stemMixer?.setAutoDuck(1); to.stemMixer?.setAutoDuck(1);
          from.stop(); from.setEQ(0, 0); to.setEQ(0, 0); from.setRate(1);
          fxA.setEcho(0); fxB.setEcho(0);
          fxA.setTransitionFilter(20); fxB.setTransitionFilter(20);
          this.running = false;
          this.onComplete?.(fromId, toId, {
            matched, style: plan.style, plan, cue,
            remix: plan.remix || 'none', loopStarted, vocalProtection: this.vocalProtection, vocalClashes
          });
        }
      };
      this.timer = requestAnimationFrame(step);
      return true;
    } catch (error) {
      this.running = false;
      if (loopStarted) from.stopLoop(.01);
      from.setMediaLevel(1, .01); from.stemMixer?.setAutoDuck(1); to.stemMixer?.setAutoDuck(1);
      to.pause(); to.setRate(1);
      throw error;
    }
  }

  cancel() {
    this.running = false; this.token++;
    if (this.timer) cancelAnimationFrame(this.timer);
    this.timer = null;
    for (const deck of Object.values(this.decks)) {
      deck.stopLoop(0); deck.setMediaLevel(1, .01); deck.stemMixer?.setAutoDuck(1);
      deck.setEQ(0, 0);
      deck.effects.setEcho(0);
      deck.effects.setTransitionFilter(20);
    }
  }
}
