import { TrackSelector } from './TrackSelector.js';
import { TransitionEngine } from './TransitionEngine.js';
import { TransitionAI } from './TransitionAI.js';

export class AutoDJ {
  constructor({ decks, mixer, getTracks, onState, onActiveDeck }) {
    this.decks = decks;
    this.mixer = mixer;
    this.getTracks = getTracks;
    this.onState = onState;
    this.onActiveDeck = onActiveDeck;
    this.selector = new TrackSelector();
    this.transitionAI = new TransitionAI();
    this.active = 'A';
    this.enabled = false;
    this.transitioning = false;
    this.history = [];
    this.playedInCycle = new Set();

    this.transitions = new TransitionEngine(mixer, decks, (from, to, result) => {
      if (result?.style) {
        const energyScore = (Number(result.plan?.energyMatch) || 50) / 100;
        this.transitionAI.learn(result.style, (result.matched ? 0.62 : 0.42) + energyScore * 0.2);
      }

      this.active = to;
      this.transitioning = false;
      const id = this.decks[to].track?.id;
      if (id) {
        this.history.push(id);
        this.history = this.history.slice(-24);
        this.playedInCycle.add(id);
      }
      this.onActiveDeck?.(to);
      // The old deck is now silent and can safely be prepared for a later cycle.
      this.prepareNext(from);
    });
  }

  setShuffle(value) {
    this.selector.shuffle = !!value;
  }

  async start() {
    const tracks = this.getTracks();
    if (tracks.length < 2) throw new Error('Add at least two tracks to start Auto DJ.');

    await this.mixer.resume();
    this.enabled = true;
    this.transitioning = false;
    this.active = 'A';
    this.playedInCycle.clear();

    const current = this.decks[this.active];
    if (!current.track || !tracks.some(track => track.id === current.track.id)) {
      current.load(tracks[Math.floor(Math.random() * tracks.length)]);
    }

    this.history = current.track?.id ? [current.track.id] : [];
    if (current.track?.id) this.playedInCycle.add(current.track.id);

    this.mixer.setDeckSide(this.active, 0.001);
    await current.play();
    await this.prepareNext('B');
    this.onState?.(true);
  }

  async prepareNext(deckId) {
    if (!this.enabled) return;
    const current = this.decks[this.active].track;
    const tracks = this.getTracks();
    if (!current || tracks.length < 2) return;

    // Do not replay a track until every other library track has had a turn.
    let excluded = [...this.playedInCycle];
    let next = this.selector.select(tracks, current, excluded);

    // Start a fresh cycle only after exhausting the available library.
    if (!next) {
      this.playedInCycle = new Set(current.id ? [current.id] : []);
      excluded = [...this.playedInCycle];
      next = this.selector.select(tracks, current, excluded);
    }

    if (next && next.id !== current.id) {
      this.decks[deckId].load(next);
    }
  }

  phraseWindow(deck) {
    const bpm = Number(deck.track?.bpm) || 0;
    const offset = Number(deck.track?.beatOffset) || 0;
    if (!bpm || (deck.track?.beatConfidence || 0) < 0.08) return null;

    // 32 beats = an estimated 8-bar phrase in 4/4. Only target the NEXT
    // boundary; never trigger again just after crossing the same boundary.
    const phraseSeconds = (60 / bpm) * 32;
    const elapsed = deck.currentTime - offset;
    if (elapsed < 0) return null;
    const phase = elapsed % phraseSeconds;
    const untilNext = phraseSeconds - phase;
    return untilNext < 0.08 ? phraseSeconds : untilNext;
  }

  async tick() {
    if (!this.enabled || this.transitioning) return;

    const current = this.decks[this.active];
    if (!current.track || !current.playing) return;

    const nextId = this.active === 'A' ? 'B' : 'A';
    if (!this.decks[nextId].track) await this.prepareNext(nextId);
    if (!this.decks[nextId].track) {
      this.stop();
      return;
    }

    const remaining = current.remaining;
    const phraseDistance = this.phraseWindow(current);
    const phraseDue = phraseDistance !== null && phraseDistance <= 0.22 && remaining > 12;
    const outroStart = Number(current.track.structure?.outroStart) || 0;
    const outroReady = outroStart > 0 && current.currentTime >= outroStart &&
      remaining > 12 && phraseDistance !== null && phraseDistance <= 1.5;
    const fallbackDue = remaining <= 10;

    if (phraseDue || outroReady || fallbackDue) {
      this.transitioning = true;
      const plan = this.transitionAI.choose(current.track, this.decks[nextId].track);
      this.onTransition?.(plan);
      const ok = await this.transitions.transition(
        this.active,
        nextId,
        Math.min(12, Math.max(5, remaining)),
        plan
      );
      if (!ok) this.transitioning = false;
    }
  }

  stop() {
    this.enabled = false;
    this.transitioning = false;
    this.transitions.cancel();
    this.onState?.(false);
  }

  destroy() {
    this.stop();
  }
}
