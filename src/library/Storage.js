const DB_NAME = 'auto-dj-v2', DB_VERSION = 1;
let dbPromise;
function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('tracks')) { const store = db.createObjectStore('tracks', { keyPath: 'id' }); store.createIndex('addedAt', 'addedAt'); }
      if (!db.objectStoreNames.contains('playlists')) db.createObjectStore('playlists', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}
async function request(store, mode, operation) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode), req = operation(tx.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.onabort = () => reject(tx.error);
  });
}
export class Storage {
  getAllTracks() { return request('tracks', 'readonly', s => s.getAll()); }
  putTrack(track) { return request('tracks', 'readwrite', s => s.put(track)); }
  deleteTrack(id) { return request('tracks', 'readwrite', s => s.delete(id)); }
  getPlaylists() { return request('playlists', 'readonly', s => s.getAll()); }
  putPlaylist(item) { return request('playlists', 'readwrite', s => s.put(item)); }
  getSetting(key) { return request('settings', 'readonly', s => s.get(key)); }
  putSetting(key, value) { return request('settings', 'readwrite', s => s.put({ key, value })); }
}
export const storage = new Storage();
export const makeId = () => crypto.randomUUID?.() || String(Date.now()) + Math.random().toString(16).slice(2);