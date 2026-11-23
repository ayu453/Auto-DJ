const $=(s,r)=>r.querySelector(s);
export function mountStemConsole(root,{decks,toast}){
 const panel=document.createElement('section');panel.className='panel stem-console';
 panel.innerHTML=`<div class="mix-title">PHASE 5 · STEM PERFORMANCE & MASHUP</div><p class="stem-note">Import already-separated audio stems named with vocals, drums, bass or other. Each deck can mix the parts independently for vocal swaps and instrumental mashups. Automatic stem extraction is not included in this browser build.</p><div class="stem-decks">${['A','B'].map(id=>`<div class="stem-unit"><div class="stem-head"><strong>DECK ${id} STEMS</strong><label class="btn" for="stemFiles${id}">＋ LOAD STEM PACK</label><input id="stemFiles${id}" type="file" accept="audio/*" multiple hidden></div><div class="stem-status" id="stemStatus${id}">No stem pack loaded</div>${['vocals','drums','bass','other'].map(role=>`<label class="stem-fader">${role.toUpperCase()} <input type="range" min="0" max="100" value="100" data-stem="${id}" data-role="${role}"><span id="stemVal${id}${role}">100%</span></label>`).join('')}<button class="tiny" data-clear-stems="${id}">CLEAR STEM PACK</button></div>`).join('')}</div>`;
 $('.pro-console',root)?.after(panel);
 for(const id of ['A','B']){
  $('#stemFiles'+id,panel).addEventListener('change',async e=>{const files=[...e.target.files];if(!files.length)return;try{const roles=await decks[id].loadStemPack(files);$('#stemStatus'+id,panel).textContent='Loaded: '+roles.join(', ').toUpperCase()+' · original mix muted during playback';toast('Deck '+id+' stem pack ready.');}catch(err){toast('Stem import failed: '+err.message);}e.target.value='';});
 }
 panel.querySelectorAll('[data-stem]').forEach(input=>input.addEventListener('input',()=>{const id=input.dataset.stem,role=input.dataset.role,value=+input.value;decks[id].setStemLevel(role,value/100);$('#stemVal'+id+role,panel).textContent=value+'%';}));
 panel.addEventListener('click',e=>{const b=e.target.closest('[data-clear-stems]');if(!b)return;const id=b.dataset.clearStems;decks[id].clearStemPack();$('#stemStatus'+id,panel).textContent='No stem pack loaded';toast('Deck '+id+' stem pack cleared.');});
 return {destroy(){}};
}