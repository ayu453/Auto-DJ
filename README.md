# AUTO DJ 3.0 — Phase 2: Remix Engine

A browser-based autonomous DJ console for local audio. Phase 1 provides track analysis, tempo matching, phrase-aware cueing and autonomous deck rotation. Phase 2 adds short, quantized remix layers during transitions.

## Run locally

Requires Node.js 18+.

```bash
npm install
npm run dev
```

Open the local Vite URL (normally http://localhost:5173). Build with `npm run build` and preview with `npm run preview`.

## Phase 1 — Real DJ Engine

- Two independent local-audio decks with a persistent IndexedDB music library.
- On-device BPM, beat phase, confidence, musical-key and coarse section estimates.
- Phrase-aware transition scheduling with an end-of-track fallback.
- Incoming cue selection snapped to a four-beat bar.
- Conservative tempo matching through SoundTouchJS AudioWorklet when supported, with native browser pitch-preservation fallback.
- Automatic bass EQ handoff, filter/echo recipes and equal-power crossfading.
- No-repeat track rotation until the available library has been played.
- Manual deck controls, seek sliders, master level and 3-band EQ.

## Phase 2 — Remix Engine

- Quantized audio-buffer loop layer using short excerpts from the outgoing track.
- Beat-roll recipe: one-beat loop repeated for a controlled two-bar window.
- Half-beat stutter recipe for rhythmic transition variation.
- Bar-loop, build-up and drop-release recipes selected by the adaptive local planner.
- Loop layer is time-limited, then fades out while the original track returns to full level.
- Transition filter, echo and bass handoff are combined with the selected remix recipe.
- Console reports the selected remix technique and loop length.

## Audio limitations — read before testing

The remix layer repeats a segment of the full mixed track. It does **not** yet isolate drums, vocals or instruments, and it is not a stem-based mashup engine. Beat-roll and stutter quality depends on BPM/beat-phase analysis accuracy and the chosen source segment. This is a first practical remix layer, not a claim of feature parity with professional DJ hardware.

BPM, beat phase, intro/outro and section labels are estimates. Mixed genres, live drumming, tempo changes, silence and complex arrangements can reduce accuracy. Beatmatching is intentionally limited to a small tempo range. Browser media playback is not sample-accurate, so cue alignment can vary by device and browser.

The transition planner is an on-device adaptive heuristic, not a cloud neural model. Real listening tests on PC browsers and varied local music are required before calling the phase production-validated.

## Test checklist

1. Add at least 4 varied tracks with clear steady beats.
2. Start Auto DJ and listen for bar-loop, beat-roll and half-beat-stutter transitions.
3. Check that the remix layer exits after its short planned window and the outgoing track does not remain ducked.
4. Use the seek slider to move the outgoing track near its ending to test transitions quickly.
5. Listen for incoming bar alignment, tempo stability, bass handoff and clean deck switching.
6. Repeat with different BPM gaps, genres and tracks with weaker beat detection.

## Music sources

Local audio files are the mixing source. Spotify audio is not captured or mixed; any future Spotify integration must use official discovery/metadata APIs and respect playback and developer terms.

## Data and privacy

Audio blobs and analysis metadata stay in this browser's IndexedDB. Clearing site data can erase the library. No audio upload or cloud music storage is used.

## Stack

Vite, vanilla JavaScript, Web Audio API, AudioWorklet, SoundTouchJS and IndexedDB.

## Phase 3 — AI DJ Brain

- Local session brain ranks next tracks by tempo, harmonic key compatibility, estimated energy fit, beat-analysis confidence and artist/recent-track variety.
- A gentle session energy arc guides the progression instead of choosing by BPM alone.
- Transition outcomes update per-recipe scores; the learned profile persists in IndexedDB on this browser.
- Console displays energy target, transition count, learned recipe count and next-track fit score.
- No audio is sent to a cloud AI service. This is an explainable local adaptive heuristic, not a generative neural model.


## Phase 4 — Professional DJ Console

- Live deck waveform meters driven by each deck's Web Audio analyser (not decorative sample bars).
- Four hot-cue memory points per deck with set and jump controls.
- Beat-grid-snapped 1/2/4/8-bar loop controls plus loop exit.
- Per-deck live filter and echo controls.
- Separate cue bus with output-device selection where the browser exposes `HTMLMediaElement.setSinkId`; cue monitoring requires a compatible browser and a distinct output device.
- Local master recording through `MediaRecorder`, saved as WebM/Opus when supported.
- Rolling transition history and live beat-phase marker.
- Recording and headphone routing are browser/device dependent and need real hardware testing.

## Phase 5 — Advanced Stem Performance (initial implementation)

- Import pre-separated local stems into either deck using filenames containing `vocals`, `drums`, `bass`, or `other`.
- Independent stem faders allow vocal-only, instrumental-only, and cross-deck mashup workflows when matching stem files are supplied.
- Stem playback follows deck seek/play/pause and the deck's small tempo adjustment range. Stem files currently use playback-rate changes (which can shift pitch slightly); SoundTouch pitch preservation is not yet applied to each independent stem.
- This is **stem playback/mixing, not automatic stem separation**. No model is embedded or downloaded to split a stereo song into vocals/drums/bass. Automatic local Demucs/HTDemucs-class separation, vocal activity detection, and confidence-aware vocal clash avoidance remain the next Phase 5 engineering tasks.
- For a mashup, load the instrumental stem pack on one deck and vocals on the other; reduce the unwanted stem faders and use the crossfader/EQ to blend. Both decks need pre-separated source files.

## Updated validation checklist

1. Test live meters, hot cues, loop timing, FX and recording in desktop Chrome/Edge over HTTPS.
2. Select a second audio output and verify cue monitoring on headphones; default output mirroring is not equivalent to isolated headphone cue.
3. Import a pre-separated stem pack with filenames such as `track_vocals.wav`, `track_drums.wav`, `track_bass.wav`, and `track_other.wav`.
4. Confirm stem playback remains aligned after seek, pause/resume and transition.
5. Test CPU/memory use with long WAV/FLAC stem files and verify recording output on the target browser.
