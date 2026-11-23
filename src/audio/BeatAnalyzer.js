import { estimateKey } from './KeyAnalyzer.js';

// On-device onset-envelope beat analysis. No audio leaves the browser.
export async function analyzeFile(file) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) throw new Error('Web Audio API is unavailable.');
  const context = new Ctx();
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
    const sampleRate = buffer.sampleRate;
    const hop = Math.max(256, Math.round(sampleRate * 0.01));
    const frame = 1024;
    const envelope = [];

    // Short-window RMS envelope, averaged across channels.
    for (let start = 0; start + frame < buffer.length; start += hop) {
      let energy = 0;
      for (const channel of channels) {
        let sum = 0;
        for (let i = 0; i < frame; i += 4) {
          const sample = channel[start + i] || 0;
          sum += sample * sample;
        }
        energy += Math.sqrt(sum / Math.ceil(frame / 4));
      }
      envelope.push(energy / Math.max(1, channels.length));
    }

    // Positive energy changes approximate percussive onsets; smooth lightly.
    const novelty = new Float32Array(envelope.length);
    for (let i = 1; i < envelope.length; i++) {
      novelty[i] = Math.max(0, envelope[i] - envelope[i - 1]);
    }
    const smooth = new Float32Array(novelty.length);
    for (let i = 0; i < novelty.length; i++) {
      smooth[i] = ((novelty[i - 1] || 0) + novelty[i] + (novelty[i + 1] || 0)) / 3;
    }

    // Normalized autocorrelation over a practical dance-music tempo range.
    const minLag = Math.max(1, Math.floor(60 * sampleRate / (hop * 180)));
    const maxLag = Math.min(Math.ceil(60 * sampleRate / (hop * 65)), Math.floor(smooth.length / 3));
    let bestLag = 0, bestScore = 0;
    const scores = new Map();
    for (let lag = minLag; lag <= maxLag; lag++) {
      let xy = 0, xx = 0, yy = 0;
      for (let i = lag; i < smooth.length; i++) {
        const x = smooth[i], y = smooth[i - lag];
        xy += x * y; xx += x * x; yy += y * y;
      }
      const score = xy / (Math.sqrt(xx * yy) || 1);
      scores.set(lag, score);
      if (score > bestScore) { bestScore = score; bestLag = lag; }
    }

    // Prefer the strongest musically plausible pulse while avoiding an octave error.
    if (bestLag) {
      const alternatives = [Math.round(bestLag / 2), bestLag, bestLag * 2]
        .filter(lag => lag >= minLag && lag <= maxLag);
      let chosen = bestLag, chosenScore = -Infinity;
      for (const lag of alternatives) {
        const score = (scores.get(lag) || 0) + (lag === bestLag ? 0.012 : 0);
        if (score > chosenScore) { chosen = lag; chosenScore = score; }
      }
      bestLag = chosen;
    }

    const beatInterval = bestLag ? bestLag * hop / sampleRate : 0;
    const bpm = beatInterval ? 60 / beatInterval : 0;
    const beatFrames = beatInterval ? beatInterval * sampleRate / hop : 0;

    // Find the beat-grid phase that best explains repeated onset peaks.
    let beatOffset = 0, beatConfidence = 0;
    if (beatFrames > 0 && smooth.length > 0) {
      const phaseSteps = Math.min(120, Math.max(24, Math.round(beatFrames)));
      let bestPhaseScore = -Infinity;
      const mean = smooth.reduce((sum, value) => sum + value, 0) / smooth.length;
      for (let step = 0; step < phaseSteps; step++) {
        const phase = step * beatFrames / phaseSteps;
        let score = 0, count = 0;
        for (let position = phase; position < smooth.length; position += beatFrames) {
          const index = Math.round(position);
          if (index < smooth.length) { score += smooth[index]; count++; }
        }
        const average = count ? score / count : 0;
        if (average > bestPhaseScore) {
          bestPhaseScore = average;
          beatOffset = phase * hop / sampleRate;
        }
      }
      beatConfidence = mean > 0
        ? Math.max(0, Math.min(1, (bestScore * 1.8) * ((bestPhaseScore / mean - 1) / 2)))
        : 0;
    }

    // Coarse phrase map based on local RMS energy, useful as a cue rather than ground truth.
    const energy = [];
    const windowSize = sampleRate;
    for (let start = 0; start < buffer.length; start += windowSize) {
      const end = Math.min(buffer.length, start + windowSize);
      let sum = 0, count = 0;
      for (const channel of channels) {
        for (let i = start; i < end; i += 4) {
          const sample = channel[i] || 0;
          sum += sample * sample; count++;
        }
      }
      energy.push(Math.sqrt(sum / Math.max(1, count)));
    }
    const sorted = [...energy].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length * .5)] || 0;
    const peak = sorted[Math.floor(sorted.length * .9)] || 0;
    const activeThreshold = Math.max(median * .72, peak * .28);
    let introEnd = 0;
    for (let i = 0; i < Math.min(energy.length, Math.floor(energy.length * .3)); i++) {
      if (energy[i] >= activeThreshold) { introEnd = i; break; }
    }
    let outroStart = Math.max(0, energy.length - 1);
    for (let i = energy.length - 1; i >= Math.floor(energy.length * .7); i--) {
      if (energy[i] >= activeThreshold) { outroStart = i; break; }
    }
    const blockSeconds = beatInterval ? beatInterval * 32 : 16;
    const blockSize = Math.max(1, Math.round(blockSeconds));
    const sections = [];
    for (let i = 0; i < energy.length; i += blockSize) {
      const slice = energy.slice(i, Math.min(energy.length, i + blockSize));
      const average = slice.reduce((a, b) => a + b, 0) / Math.max(1, slice.length);
      const relative = peak ? average / peak : 0;
      sections.push({
        start: i, end: Math.min(energy.length, i + blockSize),
        energy: Math.round(relative * 100) / 100,
        section: relative > .78 ? 'high-energy' : relative < .34 ? 'break' : 'groove'
      });
    }
    const averageEnergy = energy.reduce((a, b) => a + b, 0) / Math.max(1, energy.length);
    const structure = {
      introEnd, outroStart,
      energy: peak ? Math.round(averageEnergy / peak * 100) / 100 : 0,
      sections: sections.slice(0, 100)
    };
    const keyInfo = estimateKey(buffer);
    return {
      duration: buffer.duration,
      bpm: bpm ? Math.round(bpm * 10) / 10 : 0,
      beatOffset,
      beatConfidence: Math.round(beatConfidence * 100) / 100,
      beatInterval,
      phraseLength: beatInterval ? beatInterval * 32 : 0,
      ...keyInfo, structure, analysisVersion: 5
    };
  } finally {
    await context.close();
  }
}
