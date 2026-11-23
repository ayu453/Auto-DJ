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

## Phase 5 — AI Stem Intelligence & Live Mashups

### Automatic on-device separation

- Each loaded deck can run HTDemucs source separation locally in a module worker using ONNX Runtime Web.
- Produces four independent stems: vocals, drums, bass and other.
- Uses the single-model four-stem HTDemucs ONNX export hosted by StemSplit on Hugging Face. The model is approximately 166 MB and is downloaded on first use; the browser may cache it for later sessions.
- Audio is decoded and processed in 7.8-second chunks with 25% overlap and overlap-add reconstruction. Audio is not uploaded to an application server.
- WebGPU is preferred when available, with WASM fallback. Cross-origin isolation headers are enabled to allow multi-threaded WASM where the browser supports it.
- Browser memory safety limit adapts to the browser's device-memory estimate: about 2 minutes on low-memory devices, 4 minutes on mid-range devices, and up to 6 minutes on higher-memory PCs. Long tracks still require substantial RAM; use a desktop browser and close memory-heavy tabs before separating.
- Separation is offline after the model has loaded, but first model download requires an internet connection.

### Live stem performance

- Separate four-stem packs can be generated for either deck and mixed independently with vocals/drums/bass/other faders.
- Manual pre-separated stem import remains available.
- One-touch mashup presets: Deck A instrumental + Deck B vocals, or the reverse.
- Vocal activity is estimated from the isolated vocal stem's short-window RMS envelope.
- Automatic vocal clash protection checks both decks during a transition and ducks the incoming vocal stem while both vocal parts are active, then restores its fader level.
- Stem levels, activity maps and playback buffers are session-local; generated stems are not persisted to IndexedDB after reload.
- Deck seek, play, pause, stop and tempo-rate changes are reflected in the stem playback path. Independent stems currently follow playback-rate changes; pitch-preserving SoundTouch processing for each stem is not yet implemented.

### Phase 5 limitations

- HTDemucs is a source-separation model, not a perfect multitrack studio stem export. Bleed and artifacts can remain, especially in dense mixes.
- Vocal activity detection is a local signal-level estimate on the separated vocal stem, not lyric/speech recognition. Reverb, backing vocals and quiet singing can affect its accuracy.
- Vocal protection only operates when both decks have AI-separated or imported vocal stems.
- Model inference can take longer than the track duration on some CPUs. WebGPU support varies by browser and graphics hardware.
- This does not upload music or connect to Spotify audio.

### Phase 5 validation checklist

1. Load a local track on Deck A and press **AI SEPARATE CURRENT TRACK**. The first run downloads the model; later runs may use the browser cache.
2. Confirm four stem faders appear and each can be changed independently.
3. Repeat on Deck B, then test both one-touch mashup presets.
4. Enable vocal clash protection and test a transition where both decks have vocals; listen for incoming-vocal ducking and smooth recovery.
5. Seek, pause/resume, change tempo slightly, and verify stem alignment against the original track.
6. Test with a long track on the target PC and monitor memory, browser responsiveness and audio quality.

### AI model and runtime references

- HTDemucs ONNX model and browser inference guide: https://github.com/StemSplit/demucs-onnx
- Browser model distribution: https://huggingface.co/StemSplitio/htdemucs-onnx
- ONNX Runtime Web: https://onnxruntime.ai/

The model and ONNX runtime are third-party dependencies. Their own licenses and terms apply.
