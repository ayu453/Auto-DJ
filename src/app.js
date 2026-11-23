import { AudioEngine } from './audio/AudioEngine.js';
import { Deck } from './audio/Deck.js';
import { Mixer } from './audio/Mixer.js';
import { AutoDJ } from './autodj/AutoDJ.js';
import { MusicLibrary } from './library/MusicLibrary.js';
import { storage } from './library/Storage.js';
import { renderWaveform } from './components/Waveform.js';
import { updateDeckUI } from './components/DeckUI.js';
import { renderLibrary } from './components/LibraryUI.js';

const $ = (selector, root = document) => root.querySelector(selector);
export function mountApp(root) {
  root.innerHTML = `<main class="shell">
    <header class="topbar"><div class="brand"><div class="logo">A</div><div><h1>AUTO DJ</h1><small>V3.0 · PHASE 1 REAL DJ ENGINE</small></div></div><div class="status"><i class="dot"></i><span id="systemStatus">SYSTEM READY</span></div></header>
    <section class="hero"><div><div class="eyebrow">AUTONOMOUS MIXING · LOCAL AUDIO ANALYSIS</div><h2>Let the music flow.</h2><p>Load your tracks, press Start, and AUTO DJ handles the decks, tempo and transitions.</p></div><div class="auto-state" id="autoState">● AUTO DJ STANDBY</div></section>
    <section class="decks">${['A','B'].map(id => `<article class="panel deck" id="deck${id}"><div class="deck-head"><span class="deck-name">DECK ${id}</span><span class="deck-state" id="state${id}">EMPTY</span></div><div class="track-title" id="title${id}">No track loaded</div><div class="track-sub" id="artist${id}">Add music to your library</div><div class="wave" id="wave${id}"></div><div class="progress"><i id="progress${id}"></i></div><input class="seek-slider" id="seek${id}" type="range" min="0" max="0" step="0.1" value="0" data-seek="${id}" aria-label="Seek Deck ${id} position" disabled><div class="time-row"><span id="elapsed${id}">0:00</span><span id="duration${id}">0:00</span></div><div class="controls"><button class="btn iconbtn" data-action="cue" data-deck="${id}" title="Return to start">↶</button><button class="btn iconbtn primary" data-action="play" data-deck="${id}" title="Play / pause">▶</button><button class="btn iconbtn" data-action="stop" data-deck="${id}" title="Stop">■</button></div><div class="knobs">${['LOW','MID','HIGH'].map((band,i)=>`<div class="control"><label>${band} EQ <span id="${band.toLowerCase()}Val${id}">0 dB</span></label><input type="range" min="-12" max="12" value="0" data-eq="${i}" data-deck="${id}"></div>`).join('')}</div></article>`).join('')}</section>
    <section class="panel mixer"><div><div class="mix-title">MASTER OUTPUT</div><div class="mix-control"><label>MASTER LEVEL <span id="masterVal">80%</span></label><input id="master" type="range" min="0" max="100" value="80"></div></div><div><div class="mix-title">CROSSFADER</div><div class="cross-wrap"><span>DECK A</span><input id="crossfader" type="range" min="0" max="100" value="50"><span>DECK B</span></div></div><div class="mix-actions"><button class="btn primary" id="startAuto">▶ START AUTO DJ</button><button class="btn" id="stopAuto">STOP AUTO</button></div></section>
    <section class="panel ai-lab"><div><div class="mix-title">AI TRANSITION LAB</div><strong id="aiTransition">Waiting for mix…</strong><p id="aiReason">AI experiments with creative transition styles and adapts its choices during this session.</p></div><div class="ai-tags"><span>SECTION AWARE</span><span>MULTI-EFFECT RECIPES</span><span>ADAPTIVE LEARNING</span></div></section>
    <section class="panel library"><div class="library-head"><div><h3>MUSIC LIBRARY <span id="trackCount" class="muted">(0 tracks)</span></h3><small class="muted">Stored locally in this browser</small></div><div class="library-actions"><input id="search" class="search" placeholder="Search tracks…"><label class="btn primary" for="filePicker">＋ ADD MUSIC</label><input id="filePicker" class="file-input" type="file" accept="audio/*" multiple><button class="btn" id="shuffle">SHUFFLE</button></div></div><div class="track-list" id="trackList"><div class="empty">Your library is empty. Add local audio files to get started.</div></div><div class="notice">Audio files and analysis stay on this device. AUTO DJ estimates BPM, beat phase, key, intro/outro and energy sections locally. Pitch-preserving tempo matching uses an AudioWorklet when supported; otherwise the browser's native pitch preservation is used. Spotify is not used as a mixing audio input.</div></section>
  </main><div id="toast" hidden class="toast"></div>`;

  let engine, decks, mixer, autoDJ, library = new MusicLibrary(), toastTimer;
  const setStatus = text => { $('#systemStatus',root).textContent = text; };
  const toast = message => {
    const el = $('#toast',root); el.textContent = message; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.hidden = true, 3200);
  };
  const updateDeck = id => updateDeckUI(id, decks[id], root);
  const refreshLibrary = () => {
    renderLibrary($('#trackList',root), library.tracks, $('#search',root).value);
    $('#trackCount',root).textContent = '(' + library.tracks.length + ' tracks)';
  };
  const loadTrack = async (id, track) => {
    await mixer.resume(); decks[id].load(track);
    renderWaveform($('#wave' + id,root)); updateDeck(id); setStatus('TRACK LOADED');
  };
  const setAutoState = enabled => {
    $('#autoState',root).textContent = enabled ? '● AUTO DJ ACTIVE' : '● AUTO DJ STANDBY';
    setStatus(enabled ? 'AUTOMIX RUNNING' : 'SYSTEM READY');
  };
  async function addFiles(files) {
    let errors = 0, completed = 0;
    await library.addFiles(files, result => {
      if (result.error) errors++;
      else completed++;
      setStatus('ANALYSING MUSIC ' + (completed + errors) + '/' + files.length);
    });
    refreshLibrary();
    setStatus('SYSTEM READY');
    toast(errors ? completed + ' added · ' + errors + ' could not be analysed.' : completed + ' tracks analysed and added.');
  }
  async function boot() {
    try {
      engine = new AudioEngine();
      await engine.initialize();
      decks = { A:new Deck('A',engine), B:new Deck('B',engine) };
      mixer = new Mixer(engine,decks.A,decks.B);
      autoDJ = new AutoDJ({decks,mixer,getTracks:()=>library.tracks,onState:setAutoState,onActiveDeck:updateDeck});
      autoDJ.onTransition = plan => { $('#aiTransition',root).textContent = plan.style.replaceAll('-',' ').toUpperCase(); const parts=[plan.reason,Math.round(plan.confidence*100)+'% confidence',plan.bars+' bars',plan.usesDrop?'detected drop cue':'phrase cue','energy fit '+plan.energyMatch+'%']; $('#aiReason',root).textContent = parts.join(' · '); };
      await library.load();
      const setting = await storage.getSetting('shuffle');
      autoDJ.setShuffle(!!setting?.value);
      $('#shuffle',root).textContent = setting?.value ? 'SHUFFLE ON' : 'SHUFFLE';
      refreshLibrary();
      ['A','B'].forEach(id => { renderWaveform($('#wave' + id,root)); updateDeck(id); });
      if (!engine.workletReady) toast('Pitch-preserving browser fallback active. Use HTTPS or a supported browser for the DJ time-stretch engine.');
    } catch(error) {
      console.error(error); toast('Audio engine could not start in this browser.');
      setStatus('AUDIO UNAVAILABLE'); return;
    }

    root.addEventListener('click', async event => {
      const load = event.target.closest('[data-load]');
      if (load) {
        const track = library.tracks.find(t => t.id === load.dataset.id);
        if (track) await loadTrack(load.dataset.load,track);
        return;
      }
      const remove = event.target.closest('[data-delete]');
      if (remove) { await library.remove(remove.dataset.delete); refreshLibrary(); return; }
      const action = event.target.closest('[data-action]');
      if (action) {
        const deck = decks[action.dataset.deck]; await mixer.resume();
        if (action.dataset.action === 'play') {
          if (deck.playing) deck.pause();
          else if (deck.track) await deck.play();
          else toast('Load a track first.');
        } else if (action.dataset.action === 'stop') deck.stop();
        else if (action.dataset.action === 'cue') deck.cue();
        updateDeck(action.dataset.deck);
      }
    });
    $('#filePicker',root).addEventListener('change', event => {
      addFiles([...event.target.files]); event.target.value = '';
    });
    $('#search',root).addEventListener('input',refreshLibrary);
    root.querySelectorAll('[data-seek]').forEach(input => input.addEventListener('input', () => {
      const id = input.dataset.seek;
      if (decks[id]) {
        decks[id].setCurrentTime(Number(input.value));
        updateDeck(id);
      }
    }));
    $('#crossfader',root).addEventListener('input',event => mixer.setCrossfader(+event.target.value / 100));
    $('#master',root).addEventListener('input',event => {
      mixer.setMaster(+event.target.value / 100);
      $('#masterVal',root).textContent = event.target.value + '%';
    });
    root.querySelectorAll('[data-eq]').forEach(input => input.addEventListener('input',() => {
      const id = input.dataset.deck, band = +input.dataset.eq, value = +input.value;
      decks[id].setEQ(band,value);
      $('#' + ['lowVal','midVal','highVal'][band] + id,root).textContent = value + ' dB';
    }));
    $('#startAuto',root).addEventListener('click',async () => {
      try {
        await autoDJ.start();
        toast(engine.workletReady ? 'AUTO DJ started · pitch-preserving mix engine ready.' : 'AUTO DJ started · browser pitch-preserving fallback active.');
      } catch(error) { toast(error.message); }
    });
    $('#stopAuto',root).addEventListener('click',() => {
      autoDJ.stop(); setAutoState(false); toast('AUTO DJ stopped.');
    });
    $('#shuffle',root).addEventListener('click',async () => {
      const next = !autoDJ.selector.shuffle;
      autoDJ.setShuffle(next); await storage.putSetting('shuffle',next);
      $('#shuffle',root).textContent = next ? 'SHUFFLE ON' : 'SHUFFLE';
      toast(next ? 'Shuffle enabled.' : 'Tempo and harmonic matching priority enabled.');
    });
    const frame = async () => {
      if (!root.isConnected) return;
      for (const id of ['A','B']) updateDeck(id);
      await autoDJ.tick();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    window.addEventListener('beforeunload',() => {
      autoDJ.destroy(); decks.A.dispose(); decks.B.dispose(); engine.destroy();
    },{once:true});
  }
  boot();
}
