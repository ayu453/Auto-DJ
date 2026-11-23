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
    await this.mixer.resume();
    this.enabled = true; this.transitioning = false;
    let current = this.decks[this.active];
    if (!current.track) current.load(tracks[Math.floor(Math.random() * tracks.length)]);
    this.mixer.setDeckSide(this.active, .001);
    await current.play();
    await this.prepareNext(this.active === 'A' ? 'B' : 'A');
    this.onState?.(true);
  }
  async prepareNext(deckId) {
    if (!this.enabled) return;
    const current = this.decks[this.active].track;
    const next = this.selector.select(this.getTracks(), current);
    if (next) this.decks[deckId].load(next);
  }
  nextPhraseTime(deck) {
    const bpm = deck.track?.bpm || 0;
    const beatOffset = Number(deck.track?.beatOffset) || 0;
    if (!bpm || (deck.track?.beatConfidence || 0) < .08) return null;
    const beat = 60 / bpm;
    const phrase = beat * 32; // 8 bars in 4/4
    const elapsed = Math.max(0, deck.currentTime - beatOffset);
    return beatOffset + (Math.floor(elapsed / phrase) + 1) * phrase;
  }
  async tick() {
    if (!this.enabled || this.transitioning) return;
    const current = this.decks[this.active];
    if (!current.track) return;
    const nextId = this.active === 'A' ? 'B' : 'A';
    if (!this.decks[nextId].track) await this.prepareNext(nextId);
    if (!this.decks[nextId].track) { this.stop(); return; }

    const remaining = current.remaining;
    const phraseTime = this.nextPhraseTime(current);
    const phraseDue = phraseTime !== null && phraseTime <= current.duration - 2 && current.currentTime >= phraseTime - .12;
    const fallbackDue = remaining <= 10;
    // Prefer the next 8-bar phrase boundary; fall back near the end for uncertain analyses.
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
