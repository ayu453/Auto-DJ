import { storage, makeId } from './Storage.js';
export class Playlists {
  async all() { return storage.getPlaylists(); }
  async create(name, trackIds = []) {
    const playlist = { id: makeId(), name: String(name).trim() || 'New playlist', trackIds, createdAt: Date.now() };
    await storage.putPlaylist(playlist); return playlist;
  }
  async addTrack(playlist, trackId) {
    if (!playlist.trackIds.includes(trackId)) playlist.trackIds.push(trackId);
    await storage.putPlaylist(playlist); return playlist;
  }
  async removeTrack(playlist, trackId) {
    playlist.trackIds = playlist.trackIds.filter(id => id !== trackId);
    await storage.putPlaylist(playlist); return playlist;
  }
}