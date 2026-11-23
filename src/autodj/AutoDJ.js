import { StemSeparator } from '../audio/StemSeparator.js';
import { TrackSelector } from './TrackSelector.js';
import { TransitionEngine } from './TransitionEngine.js';
import { TransitionAI } from './TransitionAI.js';
import { SessionBrain } from './SessionBrain.js';

export class AutoDJ {
  constructor({ decks, mixer, getTracks, onState, onActiveDeck, onBrainUpdate, onAIStatus }) {
    this.decks = decks; this.mixer = mixer; this.getTracks = getTracks;
    this.onState = onState; this.onActiveDeck = onActiveDeck; this.onBrainUpdate = onBrainUpdate; this.onAIStatus = onAIStatus;
    this.stemSeparator = new StemSeparator({ onStatus: message => this.onAIStatus?.(message) });
    this.stemQueue = Promise.resolve(); this.stemJobs = new Map();
    this.selector = new TrackSelector(); this.transitionAI = new TransitionAI(); this.brain = new SessionBrain();
    this.active = 'A'; this.enabled = false; this.transitioning = false;
    this.history = []; this.playedInCycle = new Set();
    this.transitions = new TransitionEngine(mixer, decks, (from, to, result) => {
      this.brain.recordTransition(this.decks[to].track, result);
      if (result?.style) {
        const energyScore = (Number(result.plan?.energyMatch) || 50) / 100;
        this.transitionAI.learn(result.style, (result.matched ? .62 : .42) + energyScore * .2);
      }
      this.active = to; this.transitioning = false;
      const id = this.decks[to].track?.id;
      if (id) { this.history.push(id); this.history = this.history.slice(-24); this.playedInCycle.add(id); }
      this.onActiveDeck?.(to); this.onBrainUpdate?.(this.brain.getSummary()); this.prepareNext(from);
    });
  }
  setShuffle(value) { this.selector.shuffle = !!value; }
  prepareStemMix(deckId, track) {
    const deck = this.decks[deckId];
    if (!track?.blob || deck.stemMixer.active || this.stemJobs.get(deckId) === track.id) return;
    this.stemJobs.set(deckId, track.id);
    this.stemQueue = this.stemQueue.then(async () => {
      if (deck.track !== track || deck.stemMixer.active) return;
      this.onAIStatus?.('AI preparing stems for Deck ' + deckId + '…');
      const buffers = await this.stemSeparator.separate(track.blob);
      if (deck.track !== track) return;
      deck.loadStemBuffers(buffers);
      this.onAIStatus?.('AI stems ready · Deck ' + deckId);
    }).catch(error => {
      this.onAIStatus?.('AI stem separation skipped · ' + error.message);
      console.warn('Automatic stem preparation failed', error);
    });
  }
  async start() {
    const tracks = this.getTracks();
    if (tracks.length < 2) throw new Error('Add at least two tracks to start Auto DJ.');
    await this.brain.load();
    this.transitionAI.history = new Map(Object.entries(this.brain.recipeScores));
    await this.mixer.resume();
    this.enabled = true; this.transitioning = false; this.active = 'A'; this.playedInCycle.clear();
    const current = this.decks.A;
    if (!current.track || !tracks.some(track => track.id === current.track.id)) current.load(tracks[Math.floor(Math.random() * tracks.length)]);
    this.history = current.track?.id ? [current.track.id] : [];
    if (current.track?.id) this.playedInCycle.add(current.track.id);
    this.brain.start(current.track);
    this.prepareStemMix('A', current.track);
    this.mixer.setDeckSide('A', .001); await current.play(); await this.prepareNext('B');
    this.onState?.(true); this.onBrainUpdate?.(this.brain.getSummary());
  }
  async prepareNext(deckId) {
    if (!this.enabled) return;
    const current = this.decks[this.active].track, tracks = this.getTracks();
    if (!current || tracks.length < 2) return;
    let excluded = [...this.playedInCycle];
    let next = this.selector.select(tracks, current, excluded, { brain: this.brain });
    if (!next) {
      this.playedInCycle = new Set(current.id ? [current.id] : []);
      excluded = [...this.playedInCycle];
      next = this.selector.select(tracks, current, excluded, { brain: this.brain });
    }
    if (next && next.id !== current.id) { this.decks[deckId].load(next); this.prepareStemMix(deckId, next); }
    this.onBrainUpdate?.(this.brain.getSummary());
  }
  phraseWindow(deck) {
    const bpm = Number(deck.track?.bpm) || 0, confidence = Number(deck.track?.beatConfidence) || 0;
    const offset = Number(deck.track?.beatOffset) || 0;
    if (!bpm || confidence < .12) return null;
    const phraseSeconds = (60 / bpm) * 32, elapsed = deck.currentTime - offset;
    if (elapsed < 0) return null;
    const phase = elapsed % phraseSeconds;
    return phase < .08 ? 0 : phraseSeconds - phase;
  }
  async tick() {
    if (!this.enabled || this.transitioning) return;
    const current = this.decks[this.active];
    if (!current.track || !current.playing) return;
    const nextId = this.active === 'A' ? 'B' : 'A';
    if (!this.decks[nextId].track) await this.prepareNext(nextId);
    if (!this.decks[nextId].track) { this.stop(); return; }
    const remaining = current.remaining, phraseDistance = this.phraseWindow(current);
    const plan = this.transitionAI.choose(current.track, this.decks[nextId].track);
    const bpm = Number(current.track.bpm) || 0;
    const plannedBars = Math.max(4, Math.min(16, Number(plan.bars) || 8));
    const transitionSeconds = bpm ? Math.max(5, Math.min(18, (60 / bpm) * 4 * plannedBars)) : 10;
    const nearEnd = remaining <= transitionSeconds + 2.5;
    const phraseDue = nearEnd && phraseDistance !== null && phraseDistance <= .22;
    const outroStart = Number(current.track.structure?.outroStart) || 0;
    const outroReady = nearEnd && outroStart > 0 && current.currentTime >= outroStart && phraseDistance !== null && phraseDistance <= 1.5;
    const fallbackDue = remaining <= transitionSeconds + .75;
    if (phraseDue || outroReady || fallbackDue) {
      this.transitioning = true; this.onTransition?.(plan);
      const ok = await this.transitions.transition(this.active, nextId, transitionSeconds, plan);
      if (!ok) this.transitioning = false;
    }
  }
  stop() { this.enabled = false; this.transitioning = false; this.transitions.cancel(); this.onState?.(false); }
  destroy() { this.stop(); this.stemSeparator.cancel(); }
}
