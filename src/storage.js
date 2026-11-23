const DB_NAME='auto-dj-v2', DB_VERSION=1;
let dbPromise;
function openDB(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains('tracks')){const s=db.createObjectStore('tracks',{keyPath:'id'});s.createIndex('addedAt','addedAt');}
      if(!db.objectStoreNames.contains('playlists'))db.createObjectStore('playlists',{keyPath:'id'});
      if(!db.objectStoreNames.contains('settings'))db.createObjectStore('settings',{keyPath:'key'});
    };
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });return dbPromise;
}
async function request(store,mode,fn){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(store,mode);const req=fn(tx.objectStore(store));req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);tx.onabort=()=>reject(tx.error);});}
export const storage={
  getAllTracks:()=>request('tracks','readonly',s=>s.getAll()),
  putTrack:track=>request('tracks','readwrite',s=>s.put(track)),
  deleteTrack:id=>request('tracks','readwrite',s=>s.delete(id)),
  clearTracks:()=>request('tracks','readwrite',s=>s.clear()),
  getPlaylists:()=>request('playlists','readonly',s=>s.getAll()),
  putPlaylist:p=>request('playlists','readwrite',s=>s.put(p)),
  getSetting:key=>request('settings','readonly',s=>s.get(key)),
  putSetting:(key,value)=>request('settings','readwrite',s=>s.put({key,value}))
};
export function makeId(){return crypto.randomUUID?.()||String(Date.now())+Math.random().toString(16).slice(2);}
