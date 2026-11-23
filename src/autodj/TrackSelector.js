import { keyCompatibility } from '../audio/KeyAnalyzer.js';
export class TrackSelector {
  constructor() { this.shuffle = false; }
  select(tracks, current, excluded = [], context = {}) {
    const blocked = new Set([...excluded, current?.id].filter(Boolean));
    const candidates = tracks.filter(track => !blocked.has(track.id));
    if (!candidates.length) return null;
    if (this.shuffle) return candidates[Math.floor(Math.random() * candidates.length)];
    if (context.brain) return context.brain.selectTrack(tracks, current, excluded);
    return [...candidates].sort((a,b) => this.score(a,current)-this.score(b,current))[0];
  }
  score(track,current) {
    const bpm=current?.bpm||0, candidateBpm=track?.bpm||0;
    let tempoScore=50;
    if(bpm&&candidateBpm){
      const ratio=bpm/candidateBpm,direct=Math.abs(ratio-1);
      const halfDouble=Math.min(Math.abs(ratio-2),Math.abs(ratio-.5));
      tempoScore=Math.min(direct,halfDouble*.85)*100;
      if(direct>.06) tempoScore+=20;
    }
    return tempoScore+keyCompatibility(current?.key,track?.key)*9+(1-(track?.beatConfidence||0))*2;
  }
}