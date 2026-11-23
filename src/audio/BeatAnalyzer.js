import { estimateKey } from './KeyAnalyzer.js';

// Lightweight on-device beat-grid analysis. Audio is never uploaded.
export async function analyzeFile(file) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) throw new Error('Web Audio API is unavailable.');
  const context = new Ctx();
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    const channel = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    const hop = 256, frame = 1024, envelope = [];
    for (let i = 0; i + frame < channel.length; i += hop) {
      let sum = 0;
      for (let j = 0; j < frame; j += 4) sum += channel[i + j] * channel[i + j];
      envelope.push(Math.sqrt(sum / (frame / 4)));
    }

    const novelty = envelope.map((value, index) => Math.max(0, value - (envelope[index - 1] || 0)));
    const minLag = Math.floor(60 * sampleRate / (hop * 180));
    const maxLag = Math.ceil(60 * sampleRate / (hop * 65));
    let bestLag = 0, bestScore = -Infinity;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let score = 0;
      for (let i = lag; i < novelty.length; i++) score += novelty[i] * novelty[i - lag];
      if (score > bestScore) { bestScore = score; bestLag = lag; }
    }

    let bpm = bestLag ? 60 * sampleRate / (hop * bestLag) : 0;
    if (bpm && bpm < 80) bpm *= 2;
    if (bpm > 160) bpm /= 2;

    const beatSeconds = bpm ? 60 / bpm : 0;
    const beatFrames = beatSeconds * sampleRate / hop;
    let beatOffset = 0, beatConfidence = 0;
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

    // Coarse musical structure map: one-second RMS energy windows, kept locally.
    const energy = [];
    const windowSize = sampleRate;
    for (let start = 0; start < channel.length; start += windowSize) {
      const end = Math.min(channel.length, start + windowSize);
      let sum = 0;
      for (let i = start; i < end; i += 4) sum += channel[i] * channel[i];
      energy.push(Math.sqrt(sum / Math.max(1, Math.ceil((end-start)/4))));
    }
    const sortedEnergy = [...energy].sort((x,y)=>x-y);
    const medianEnergy = sortedEnergy[Math.floor(sortedEnergy.length*.5)] || 0;
    const maxEnergy = sortedEnergy[Math.floor(sortedEnergy.length*.9)] || 0;
    const levelAt = (fraction) => energy[Math.min(energy.length-1,Math.floor(fraction*energy.length))] || 0;
    const introThreshold = Math.max(medianEnergy*.72, maxEnergy*.28);
    let introEnd = 0;
    for (let i=0;i<Math.min(energy.length,Math.floor(energy.length*.3));i++) {
      if (energy[i] >= introThreshold) { introEnd=i; break; }
    }
    let outroStart = Math.max(0,energy.length-1);
    for (let i=energy.length-1;i>=Math.floor(energy.length*.7);i--) {
      if (energy[i] >= introThreshold) { outroStart=i; break; }
    }
    const blocks = [];
    const blockSeconds = beatSeconds ? beatSeconds*8 : 16;
    const blockSize = Math.max(1,Math.round(blockSeconds));
    for(let i=0;i<energy.length;i+=blockSize){
      const slice=energy.slice(i,Math.min(energy.length,i+blockSize));
      const avg=slice.reduce((x,y)=>x+y,0)/Math.max(1,slice.length);
      const relative=maxEnergy?avg/maxEnergy:0;
      blocks.push({start:i,end:Math.min(energy.length,i+blockSize),energy:Math.round(relative*100)/100,
        section:relative>.78?'high-energy':relative<.34?'break':'groove'});
    }
    const structure = {
      introEnd, outroStart, energy: maxEnergy?Math.round((energy.reduce((x,y)=>x+y,0)/Math.max(1,energy.length))/maxEnergy*100)/100:0,
      sections: blocks.slice(0,80)
    };
    const keyInfo = estimateKey(buffer);
    return {
      duration: buffer.duration,
      bpm: bpm ? Math.round(bpm * 10) / 10 : 0,
      beatOffset,
      beatConfidence: Math.round(beatConfidence * 100) / 100,
      beatInterval: beatSeconds,
      phraseLength: beatSeconds ? beatSeconds * 32 : 0,
      ...keyInfo,
      analysisVersion: 3
    };
  } finally {
    await context.close();
  }
}
