import { TrackSelector } from './TrackSelector.js';
import { TransitionEngine } from './TransitionEngine.js';
export class AutoDJ {
  constructor({ decks, mixer, getTracks, onState, onActiveDeck }) {
    this.decks = decks; this.mixer = mixer; this.getTracks = getTracks;
    this.onState = onState; this.onActiveDeck = onActiveDeck;
    this.selector = new TrackSelector(); this.active = 'A'; this.enabled = false;
    this.transitioning = false;
    this.transitions = new TransitionEngine(mixer, decks, (from, to) => {
      this.active = to; this.transitioning = false; this.onActiveDeck?.(to);
      this.prepareNext(from);
    });
  }
  setShuffle(value) { this.selector.shuffle = !!value; }
  async start() {
    const tracks = this.getTracks();
    if (tracks.length < 2) throw new Error('Add at least two tracks to start Auto DJ.');
    await this.mixer.resume(); this.enabled = true; this.transitioning = false;
    let current = this.decks[this.active];
    if (!current.track) {
      const first = tracks[Math.floor(Math.random() * tracks.length)];
      current.load(first);
    }
    this.mixer.setDeckSide(this.active, .001);
    await current.play();
    await this.prepareNext(this.active === 'A' ? 'B' : 'A');
    this.onState?.(true);
  }
  async prepareNext(deckId) {
    if (!this.enabled) return;
    const current = this.decks[this.active].track;
    const next = this.selector.select(this.getTracks(), current, [this.decks[deckId].track?.id]);
    if (next) this.decks[deckId].load(next);
  }
  async tick() {
    if (!this.enabled || this.transitioning) return;
    const current = this.decks[this.active];
    if (!current.track) return;
    if (current.remaining <= Math.min(18, Math.max(8, current.duration * .2))) {
      const nextId = this.active === 'A' ? 'B' : 'A';
      if (!this.decks[nextId].track) await this.prepareNext(nextId);
      if (!this.decks[nextId].track) { this.stop(); return; }
      this.transitioning = true;
      const ok = await this.transitions.transition(this.active, nextId, Math.min(12, Math.max(5, current.remaining)));
      if (!ok) this.transitioning = false;
    }
  }
  stop() {
    this.enabled = false; this.transitioning = false; this.transitions.cancel();
    this.onState?.(false);
  }
  destroy() { this.stop(); }
}