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
