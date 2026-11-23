# AUTO DJ 3.0 — Phase 1: Real DJ Engine

A browser-based autonomous DJ console for local audio. Phase 1 focuses on track analysis, tempo matching, phrase-aware cueing and reliable autonomous deck rotation.

## Run locally

Requires Node.js 18+.

```bash
npm install
npm run dev
```

Open the local Vite URL (normally http://localhost:5173). Build with `npm run build` and preview with `npm run preview`.

## Phase 1 implemented

- Two independent local-audio decks with a persistent IndexedDB music library.
- On-device onset-envelope analysis and normalized autocorrelation for estimated BPM and beat phase.
- Confidence-scored beat timing, with old library tracks automatically reanalysed when the analysis version changes.
- Local musical-key estimation and confidence-aware track selection.
- Phrase-aware transition scheduling: estimated 8-bar phrase boundaries are considered only near the outgoing track's end, with a safe end-of-track fallback.
- Incoming cue selection snapped to a four-beat bar, taking the estimated intro and beat phase into account.
- Conservative tempo matching through SoundTouchJS AudioWorklet when supported, with native browser pitch-preservation fallback.
- Automatic bass EQ handoff, filter/echo transition recipes and equal-power crossfading.
- No-repeat track rotation until the available library has been played.
- Manual deck controls, seek sliders, master level and 3-band EQ.

## Important audio limitations

BPM, beat phase, intro/outro and section labels are estimates, not guaranteed professional-grade beat grids. Mixed genres, live drumming, tempo changes, silence and complex arrangements can reduce accuracy. Beatmatching is intentionally limited to a small tempo range to avoid excessive audio artifacts. Browser media playback is not sample-accurate, so cue alignment can vary slightly by device and browser.

The transition planner is a local adaptive heuristic, not a cloud neural model. The existing one-bar loop sampler is an early transition layer; full beat rolls, controlled loop performance, stem separation and advanced remix controls belong to Phase 2.

## Test checklist

1. Add at least 4 varied tracks with clear steady beats.
2. Check the estimated BPM and musical key for obvious errors.
3. Start Auto DJ and confirm both decks play in sequence.
4. Use the seek slider to move the outgoing track near its final phrase.
5. Listen for incoming bar alignment, tempo stability, bass handoff and clean end-of-track switching.
6. Repeat with tracks that differ by more than 6% BPM and with tracks that have weak or uncertain beat detection.

A successful production build does not replace listening tests on real local audio and target PC browsers.

## Music sources

Local audio files are the mixing source. Spotify audio is not captured or mixed; any future Spotify integration must use official discovery/metadata APIs and respect playback and developer terms.

## Data and privacy

Audio blobs and analysis metadata stay in this browser's IndexedDB. Clearing site data can erase the library. No audio upload or cloud music storage is used.

## Stack

Vite, vanilla JavaScript, Web Audio API, AudioWorklet, SoundTouchJS and IndexedDB.
