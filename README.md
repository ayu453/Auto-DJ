# AUTO DJ 2.0

An AI-free browser DJ console for mixing audio files from your local music library.

## Run locally

Requirements: Node.js 18+.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (normally http://localhost:5173).

Create a production build with `npm run build`; preview it with `npm run preview`.

## Current features

- Two independent playback decks with play, pause, stop and return-to-start controls.
- Local audio import and persistent IndexedDB library (audio blobs stay in the browser).
- Basic BPM estimation using conventional signal processing (not AI).
- BPM-proximity track selection, with optional shuffle.
- Automatic end-of-track handoff and equal-power crossfade.
- Per-deck low, mid and high EQ; master level; crossfader.
- Responsive dark DJ-console interface.
- Web Audio compressor on the master output.

## Important limitations

This is the first functional V2 foundation, not yet a club-grade unattended mixing system. BPM estimates can be inaccurate, and phrase detection, beat-grid alignment, pitch-preserving time-stretch, waveform decoding, hot cues, effects, loops, playlist editing/export, and Spotify account integration are not implemented yet. The current crossfade is a timed fade rather than beat/phrase-aligned mixing. Test with a small set of local tracks before relying on a long session.

Spotify is not an audio source for the mixing engine. Spotify discovery or metadata integration can be added separately using its official APIs and applicable playback rules.

## Data and privacy

The app uses IndexedDB in the current browser profile. Clearing browser site data can erase the library. There is no account, cloud database, analytics service, or upload of audio files.

## Technology

Vite, vanilla JavaScript, Web Audio API, HTML Audio, and IndexedDB. No AI or machine-learning service is used.
