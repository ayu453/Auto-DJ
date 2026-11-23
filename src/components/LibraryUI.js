const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = seconds => {
  const m = Math.floor((seconds || 0) / 60), s = Math.floor((seconds || 0) % 60);
  return m + ':' + String(s).padStart(2, '0');
};
export function renderLibrary(element, tracks, query = '') {
  const q = query.toLowerCase();
  const visible = tracks.filter(t => (t.name + ' ' + (t.artist || '')).toLowerCase().includes(q));
  element.innerHTML = visible.length ? visible.map((t, i) => {
    const analysis = [t.bpm ? t.bpm + ' BPM' : 'BPM pending', t.key || 'Key pending'].join(' · ');
    return `<div class="track-row"><div class="track-index">${i + 1}</div><div class="track-info"><strong>${esc(t.name)}</strong><small>${esc(t.artist || t.fileName || 'Local audio')} · ${esc(analysis)}</small></div><div class="track-meta">${t.bpm ? t.bpm + ' BPM' : '— BPM'}</div><div class="track-meta">${fmt(t.duration)}</div><div class="row-actions"><button class="tiny" data-load="A" data-id="${t.id}">LOAD A</button><button class="tiny" data-load="B" data-id="${t.id}">LOAD B</button><button class="tiny" data-delete="${t.id}">×</button></div></div>`;
  }).join('') : '<div class="empty">No matching tracks.</div>';
}
