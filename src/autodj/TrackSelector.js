export class TrackSelector {
  constructor() { this.shuffle = false; }
  select(tracks, current, excluded = []) {
    const blocked = new Set([...excluded, current?.id].filter(Boolean));
    const candidates = tracks.filter(track => !blocked.has(track.id));
    if (!candidates.length) return null;
    if (this.shuffle) return candidates[Math.floor(Math.random() * candidates.length)];

    const bpm = current?.bpm || 0;
    const confidence = current?.beatConfidence || 0;
    return [...candidates].sort((a, b) => this.score(a, bpm, confidence) - this.score(b, bpm, confidence))[0];
  }
  score(track, bpm, confidence) {
    if (!bpm || !track.bpm) return 100;
    const direct = Math.abs(track.bpm - bpm);
    const halfDouble = Math.min(Math.abs(track.bpm * 2 - bpm), Math.abs(track.bpm / 2 - bpm));
    const tempoDistance = Math.min(direct, halfDouble);
    const reliabilityPenalty = Math.max(0, .55 - (track.beatConfidence || 0)) * 12;
    return tempoDistance + reliabilityPenalty + (confidence < .2 ? 2 : 0);
  }
}
