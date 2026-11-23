export class TrackSelector {
  constructor() { this.shuffle = false; }
  select(tracks, current, excluded = []) {
    const blocked = new Set([...excluded, current?.id].filter(Boolean));
    const candidates = tracks.filter(track => !blocked.has(track.id));
    if (!candidates.length) return null;
    if (this.shuffle) return candidates[Math.floor(Math.random() * candidates.length)];
    const bpm = current?.bpm || 0;
    return [...candidates].sort((a, b) => {
      const da = bpm && a.bpm ? Math.abs(a.bpm - bpm) : 999;
      const db = bpm && b.bpm ? Math.abs(b.bpm - bpm) : 999;
      return da - db;
    })[0];
  }
}