import { storage, makeId } from './Storage.js';
import { analyzeFile } from '../audio/BeatAnalyzer.js';
const titleFrom = name => name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
export class MusicLibrary {
  constructor() { this.tracks = []; }
  async load() {
    this.tracks = await storage.getAllTracks();
    this.tracks.sort((a,b) => a.addedAt - b.addedAt);
    return this.tracks;
  }
  async addFiles(files, onProgress) {
    const added = [];
    for (const file of files) {
      if (!file.type.startsWith('audio/') && !/\.(mp3|wav|flac|m4a|aac|ogg|opus|aiff?)$/i.test(file.name)) continue;
      try {
        const info = await analyzeFile(file);
        const track = {
          id: makeId(), name: titleFrom(file.name), fileName: file.name, artist: '',
          blob: file, duration: info.duration, bpm: info.bpm,
          beatOffset: info.beatOffset, beatConfidence: info.beatConfidence,
          beatInterval: info.beatInterval, phraseLength: info.phraseLength,
          key: info.key, keyConfidence: info.keyConfidence,
          structure: info.structure, analysisVersion: info.analysisVersion, addedAt: Date.now()
        };
        await storage.putTrack(track); this.tracks.push(track); added.push(track);
        onProgress?.({ file, track });
      } catch (error) { onProgress?.({ file, error }); }
    }
    return added;
  }
  async remove(id) {
    await storage.deleteTrack(id);
    this.tracks = this.tracks.filter(track => track.id !== id);
  }
  search(query = '') {
    const q = query.toLowerCase();
    return this.tracks.filter(t => (t.name + ' ' + (t.artist || '')).toLowerCase().includes(q));
  }
}
