import { storage } from '../library/Storage.js';
import { keyCompatibility } from '../audio/KeyAnalyzer.js';

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const energyOf = track => {
  const value = Number(track?.structure?.energy);
  return Number.isFinite(value) && value > 0 ? clamp(value) : null;
};

export class SessionBrain {
  constructor() {
    this.startedAt = 0;
    this.transitions = 0;
    this.recipeScores = {};
    this.recentIds = [];
    this.lastDecision = null;
  }
  async load() {
    const saved = await storage.getSetting('ai-dj-brain-v1');
    if (saved?.value && typeof saved.value === 'object') this.recipeScores = saved.value.recipeScores || {};
  }
  start(track) {
    this.startedAt = Date.now();
    this.transitions = 0;
    this.recentIds = track?.id ? [track.id] : [];
    this.lastDecision = null;
  }
  energyTarget() {
    const minutes = Math.max(0, (Date.now() - this.startedAt) / 60000);
    const arc = .08 * Math.sin((minutes / 18) * Math.PI * 2 - Math.PI / 2);
    return clamp(.55 + arc + Math.min(.06, this.transitions * .008), .35, .78);
  }
  selectTrack(tracks, current, excluded = []) {
    const blocked = new Set([...excluded, current?.id].filter(Boolean));
    const candidates = tracks.filter(track => !blocked.has(track.id));
    if (!candidates.length) return null;
    const target = this.energyTarget();
    const ranked = candidates.map(track => {
      const a = Number(current?.bpm) || 0, b = Number(track?.bpm) || 0;
      let tempo = .5;
      if (a && b) {
        const ratio = a / b;
        const distance = Math.min(Math.abs(ratio - 1), Math.min(Math.abs(ratio - 2), Math.abs(ratio - .5)) * .9);
        tempo = clamp(1 - distance * 4);
      }
      const harmony = current?.key && track?.key ? keyCompatibility(current.key, track.key) : .5;
      const currentEnergy = energyOf(current), nextEnergy = energyOf(track);
      const energyFit = nextEnergy === null ? .45 : clamp(1 - Math.abs(nextEnergy - target) * 1.8);
      const flow = currentEnergy === null || nextEnergy === null ? .5 : clamp(1 - Math.abs(nextEnergy - currentEnergy) * 1.35);
      const confidence = clamp((Number(track.beatConfidence) || 0) * .7 + Math.min(Number(current?.keyConfidence) || 0, Number(track.keyConfidence) || 0) * .3);
      const recentPenalty = this.recentIds.includes(track.id) ? .3 : 0;
      const artist = String(track.artist || '').trim().toLowerCase();
      const currentArtist = String(current?.artist || '').trim().toLowerCase();
      const artistPenalty = artist && currentArtist && artist === currentArtist ? .12 : 0;
      const score = tempo * .34 + harmony * .18 + energyFit * .24 + flow * .12 + confidence * .12 - recentPenalty - artistPenalty;
      return { track, score, energy: nextEnergy };
    }).sort((x, y) => y.score - x.score);
    const best = ranked[0];
    this.lastDecision = {
      trackId: best.track.id, score: Math.round(best.score * 100),
      targetEnergy: Math.round(target * 100),
      trackEnergy: best.energy === null ? null : Math.round(best.energy * 100),
      reason: 'tempo + harmonic fit + session energy + variety'
    };
    return best.track;
  }
  recordTransition(track, result) {
    this.transitions++;
    if (track?.id) {
      this.recentIds.push(track.id);
      this.recentIds = this.recentIds.slice(-8);
    }
    if (result?.style) {
      const old = this.recipeScores[result.style] || { score: .5, count: 0 };
      const rating = clamp((result.matched ? .65 : .35) + (Number(result.plan?.energyMatch) || 50) / 100 * .2 + (result.loopStarted ? .1 : 0));
      const count = old.count + 1;
      this.recipeScores[result.style] = { score: old.score + (rating - old.score) / count, count };
      storage.putSetting('ai-dj-brain-v1', { recipeScores: this.recipeScores }).catch(() => {});
    }
  }
  getSummary() {
    return { targetEnergy: Math.round(this.energyTarget() * 100), transitions: this.transitions, learnedRecipes: Object.keys(this.recipeScores).length, decision: this.lastDecision };
  }
}
