export async function analyzeFile(file) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const context = new Ctx();
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    const data = buffer.getChannelData(0), sampleRate = buffer.sampleRate;
    const hop = 512, frame = 1024, energy = [];
    for (let i = 0; i + frame < data.length; i += hop) {
      let sum = 0;
      for (let j = 0; j < frame; j += 4) sum += data[i + j] * data[i + j];
      energy.push(Math.sqrt(sum / (frame / 4)));
    }
    const onset = energy.map((v, i) => Math.max(0, v - (energy[i - 1] || 0)));
    const minLag = Math.floor(60 * sampleRate / (hop * 180));
    const maxLag = Math.ceil(60 * sampleRate / (hop * 65));
    let bestLag = 0, bestScore = -1;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let score = 0;
      for (let i = lag; i < onset.length; i++) score += onset[i] * onset[i - lag];
      if (score > bestScore) { bestScore = score; bestLag = lag; }
    }
    let bpm = bestLag ? 60 * sampleRate / (hop * bestLag) : 0;
    if (bpm && bpm < 75) bpm *= 2;
    if (bpm > 170) bpm /= 2;
    return { duration: buffer.duration, bpm: bpm ? Math.round(bpm) : 0 };
  } finally { await context.close(); }
}