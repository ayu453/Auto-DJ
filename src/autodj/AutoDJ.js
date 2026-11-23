import { TrackSelector } from './TrackSelector.js';
import { TransitionEngine } from './TransitionEngine.js';

export class AutoDJ {
  constructor({ decks, mixer, getTracks, onState, onActiveDeck }) {
    this.decks = decks; this.mixer = mixer; this.getTracks = getTracks;
    this.onState = onState; this.onActiveDeck = onActiveDeck;
    this.selector = new TrackSelector(); this.active = 'A'; this.enabled = false;
    this.transitioning = false; this.history = [];
    this.transitions = new TransitionEngine(mixer, decks, (from, to) => {
      this.active = to; this.transitioning = false;
      const id = this.decks[to].track?.id;
      if (id) this.history.push(id);
      this.history = this.history.slice(-12);
      this.onActiveDeck?.(to);
      this.prepareNext(from);
    });
  }
  setShuffle(value) { this.selector.shuffle = !!value; }
  async start() {
    const tracks = this.getTracks();
    if (tracks.length < 2) throw new Error('Add at least two tracks to start Auto DJ.');
    await this.mixer.resume();
    this.enabled = true; this.transitioning = false;
    const current = this.decks[this.active];
    if (!current.track) current.load(tracks[Math.floor(Math.random() * tracks.length)]);
    this.history = current.track?.id ? [current.track.id] : [];
    this.mixer.setDeckSide(this.active, .001);
    await current.play();
    await this.prepareNext(this.active === 'A' ? 'B' : 'A');
    this.onState?.(true);
  }
  async prepareNext(deckId) {
    if (!this.enabled) return;
    const current = this.decks[this.active].track;
    const tracks = this.getTracks();
    const recentCount = Math.min(3, Math.max(1, tracks.length - 1));
    const excluded = this.history.slice(-recentCount);
    const next = this.selector.select(tracks, current, excluded);
    if (next) this.decks[deckId].load(next);
  }
  phraseWindow(deck) {
    const bpm = deck.track?.bpm || 0;
    const offset = Number(deck.track?.beatOffset) || 0;
    if (!bpm || (deck.track?.beatConfidence || 0) < .08) return null;
    const phraseSeconds = (60 / bpm) * 32;
    const elapsed = deck.currentTime - offset;
    if (elapsed < 0) return null;
    // Ignore the first downbeat; start the blend at the next 8-bar boundary.
    if (elapsed < phraseSeconds) return phraseSeconds - elapsed;
    const phase = elapsed % phraseSeconds;
    return Math.min(phase, phraseSeconds - phase);
  }
  async tick() {
    if (!this.enabled || this.transitioning) return;
    const current = this.decks[this.active];
    if (!current.track) return;
    const nextId = this.active === 'A' ? 'B' : 'A';
    if (!this.decks[nextId].track) await this.prepareNext(nextId);
    if (!this.decks[nextId].track) { this.stop(); return; }
    const remaining = current.remaining;
    const phraseDistance = this.phraseWindow(current);
    const phraseDue = phraseDistance !== null && phraseDistance <= .22 && remaining > 12;
    const fallbackDue = remaining <= 10;
    if (phraseDue || fallbackDue) {
      this.transitioning = true;
      const ok = await this.transitions.transition(this.active, nextId, Math.min(12, Math.max(5, remaining)));
      if (!ok) this.transitioning = false;
    }
  }
  stop() {
    this.enabled = false; this.transitioning = false; this.transitions.cancel();
    this.onState?.(false);
  }
  destroy() { this.stop(); }
}
