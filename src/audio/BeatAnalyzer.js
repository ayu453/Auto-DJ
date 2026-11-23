// Lightweight, on-device beat-grid analysis. Audio never leaves the browser.
export async function analyzeFile(file) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) throw new Error('Web Audio API is unavailable.');
  const context = new Ctx();
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    const channel = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    const hop = 256;
    const frame = 1024;
    const envelope = [];
    for (let i = 0; i + frame < channel.length; i += hop) {
      let sum = 0;
      for (let j = 0; j < frame; j += 4) {
        const sample = channel[i + j];
        sum += sample * sample;
      }
      envelope.push(Math.sqrt(sum / (frame / 4)));
    }

    // Positive energy change approximates percussive onsets without a remote service.
    const novelty = envelope.map((value, index) =>
      Math.max(0, value - (envelope[index - 1] || 0))
    );
    const minLag = Math.floor(60 * sampleRate / (hop * 180));
    const maxLag = Math.ceil(60 * sampleRate / (hop * 65));
    const scores = [];
    let bestLag = 0;
    let bestScore = -Infinity;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let score = 0;
      for (let i = lag; i < novelty.length; i++) score += novelty[i] * novelty[i - lag];
      // Give plausible metrical subdivisions a fair chance, then resolve half/double tempo.
      scores.push({ lag, score });
      if (score > bestScore) { bestScore = score; bestLag = lag; }
    }

    let bpm = bestLag ? 60 * sampleRate / (hop * bestLag) : 0;
    if (bpm && bpm < 80) bpm *= 2;
    if (bpm > 160) bpm /= 2;

    // Estimate beat phase by finding the strongest onset-aligned grid.
    const beatSeconds = bpm ? 60 / bpm : 0;
    const beatFrames = beatSeconds * sampleRate / hop;
    let beatOffset = 0;
    let beatConfidence = 0;
    if (beatFrames > 0 && novelty.length) {
      const searchFrames = Math.max(1, Math.ceil(beatFrames));
      let phaseScore = -Infinity;
      const mean = novelty.reduce((a, b) => a + b, 0) / novelty.length;
      for (let phase = 0; phase < searchFrames; phase++) {
        let score = 0, count = 0;
        for (let position = phase; position < novelty.length; position += beatFrames) {
          const index = Math.round(position);
          if (index < novelty.length) { score += novelty[index]; count++; }
        }
        const normalized = count ? score / count : 0;
        if (normalized > phaseScore) { phaseScore = normalized; beatOffset = phase * hop / sampleRate; }
      }
      beatConfidence = mean > 0 ? Math.max(0, Math.min(1, (phaseScore - mean) / (mean * 3))) : 0;
    }

    return {
      duration: buffer.duration,
      bpm: bpm ? Math.round(bpm * 10) / 10 : 0,
      beatOffset,
      beatConfidence: Math.round(beatConfidence * 100) / 100,
      beatInterval: beatSeconds,
      phraseLength: beatSeconds ? beatSeconds * 32 : 0,
      analysisVersion: 2
    };
  } finally {
    await context.close();
  }
}
