# AUTO DJ 2.0

An AI-free browser DJ console built with a modular JavaScript architecture.

## Run locally

Requires Node.js 18+.

```bash
npm install
npm run dev
```

Open the local Vite URL (normally http://localhost:5173). Build with `npm run build` and preview with `npm run preview`.

## Architecture

- `src/audio/`: AudioEngine, Deck, Mixer, Effects and BeatAnalyzer.
- `src/autodj/`: AutoDJ orchestration, BPM-aware TrackSelector and TransitionEngine.
- `src/library/`: MusicLibrary, IndexedDB Storage and Playlists.
- `src/components/`: DeckUI, Waveform and LibraryUI.
- `src/styles/`: base, console and responsive styles.

## Implemented

- Dual local-audio decks with independent play, pause, stop and cue controls.
- Persistent IndexedDB music library.
- Conventional signal-processing BPM estimate (not AI/ML).
- BPM-proximity selection and optional shuffle.
- Autonomous end-of-track handoff with eased equal-power crossfade and explicit deck-side routing.
- Per-deck 3-band EQ, master level and master compressor.
- Responsive console interface.

## Current limitations

This is a modular V2 foundation, not yet a fully club-grade DJ system. Beat-grid and phrase alignment, pitch-preserving time stretch, decoded waveform rendering, key detection, hot cues, loops and advanced effects remain future work. BPM estimates are approximate. The transition is a timed crossfade, not phrase-aware mixing. Browser audio codec support varies.

Spotify is not an audio input to the mixing engine. It may be integrated separately for discovery or metadata through official APIs, subject to their rules; mixing uses local audio files.

## Data and privacy

Audio blobs and library metadata stay in this browser's IndexedDB. Clearing site data can erase the library. There is no cloud database or audio upload.

## Stack

Vite, vanilla JavaScript, Web Audio API, HTML Audio and IndexedDB. No AI or machine-learning service.
