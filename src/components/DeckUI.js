export function updateDeckUI(id, deck, root) {
  const $ = selector => root.querySelector(selector);
  const track = deck.track;
  const fmt = seconds => {
    if (!Number.isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60), s = Math.floor(seconds % 60);
    return m + ':' + String(s).padStart(2, '0');
  };
  $('#title' + id).textContent = track?.name || 'No track loaded';
  $('#artist' + id).textContent = track
    ? [track.artist || track.fileName || 'Local audio', track.bpm ? track.bpm + ' BPM' : '', track.key || ''].filter(Boolean).join(' · ')
    : 'Add music to your library';
  $('#state' + id).textContent = deck.playing ? 'PLAYING' : track ? 'LOADED' : 'EMPTY';
  $('#duration' + id).textContent = fmt(deck.duration);
  $('#elapsed' + id).textContent = fmt(deck.currentTime);
  $('#progress' + id).style.width = deck.duration ? (deck.currentTime / deck.duration * 100) + '%' : '0%';
  const play = root.querySelector('#deck' + id + ' [data-action="play"]');
  if (play) play.textContent = deck.playing ? 'Ⅱ' : '▶';
}
