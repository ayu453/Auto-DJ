# AUTO DJ 2.1

A browser-based autonomous DJ console. Load local audio and let the engine manage deck rotation, tempo matching, phrase-aware transitions and EQ.

## Run locally

Requires Node.js 18+.

```bash
npm install
npm run dev
```

Open the local Vite URL (normally http://localhost:5173). Build with `npm run build` and preview with `npm run preview`.

## Implemented

- Dual local-audio decks, persistent IndexedDB library and independent manual deck controls.
- Local BPM and beat-phase estimation using conventional signal processing.
- On-device chroma-based musical key estimation with a confidence score.
- Track selection that considers tempo, harmonic compatibility and recent-play history.
- Phrase-window scheduling at the next estimated 8-bar boundary, with an end-of-track fallback.
- Conservative tempo matching through SoundTouchJS AudioWorklet, designed to preserve pitch while changing tempo.
- Automatic bass EQ handoff and equal-power crossfading.
- Native browser pitch-preservation fallback when AudioWorklet is unavailable.
- 3-band deck EQ, master level and master compressor.

## Audio engine notes

The SoundTouchJS processor runs locally in the browser's AudioWorklet thread. Audio files are decoded and analysed on the device; no music is uploaded. The worklet requires a secure context (HTTPS or localhost) and a browser with AudioWorklet support. If it cannot load, the app falls back to native media-element pitch preservation. Tempo matching is deliberately limited to a small range to reduce audible artifacts.

BPM, beat phase and key are estimates, not guaranteed DJ-grade beat grids or harmonic labels. Phrase boundaries are inferred from the estimated beat grid. Real-world performance must be tested with a diverse local music library and listening sessions.

## Known next steps

- Stronger downbeat and phrase-structure recognition (intro, verse, chorus, outro).
- Waveform beat-grid overlays, hot cues and looping.
- More transition styles and FX (echo, filter sweeps and reverb).
- Automated listening tests and broader browser/device QA.
- Better key estimation and confidence-aware harmonic mixing.

## Music sources

Local audio files are the mixing source. Spotify is not captured or mixed; any future Spotify integration must use official discovery/metadata APIs and respect their playback and developer terms.

## Data and privacy

Audio blobs and analysis metadata stay in this browser's IndexedDB. Clearing site data can erase the library. No cloud database or audio upload is used.

## Stack

Vite, vanilla JavaScript, Web Audio API, AudioWorklet, SoundTouchJS and IndexedDB.
