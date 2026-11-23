import { keyCompatibility } from '../audio/KeyAnalyzer.js';

export class TrackSelector {
  constructor() { this.shuffle = false; }
  select(tracks, current, excluded = []) {
    const blocked = new Set([...excluded, current?.id].filter(Boolean));
    const candidates = tracks.filter(track => !blocked.has(track.id));
    if (!candidates.length) return null;
    if (this.shuffle) return candidates[Math.floor(Math.random() * candidates.length)];
    return [...candidates].sort((a, b) => this.score(a, current) - this.score(b, current))[0];
  }
  score(track, current) {
    const bpm = current?.bpm || 0;
    const candidateBpm = track?.bpm || 0;
    let tempoScore = 50;
    if (bpm && candidateBpm) {
      const ratio = bpm / candidateBpm;
      // A proper tempo match is preferred; half/double-time candidates remain fallback choices.
      const direct = Math.abs(ratio - 1);
      const halfDouble = Math.min(Math.abs(ratio - 2), Math.abs(ratio - .5));
      tempoScore = Math.min(direct, halfDouble * .85) * 100;
      if (direct > .06) tempoScore += 20;
    }
    const harmonicScore = keyCompatibility(current?.key, track?.key) * 9;
    const confidencePenalty = (1 - (track?.beatConfidence || 0)) * 2;
    return tempoScore + harmonicScore + confidencePenalty;
  }
}
