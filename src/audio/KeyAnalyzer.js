const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function fft(real, imag) {
  const n = real.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const angle = -2 * Math.PI / size;
    const stepR = Math.cos(angle), stepI = Math.sin(angle);
    for (let start = 0; start < n; start += size) {
      let wr = 1, wi = 0;
      for (let j = 0; j < half; j++) {
        const even = start + j, odd = even + half;
        const tr = wr * real[odd] - wi * imag[odd];
        const ti = wr * imag[odd] + wi * real[odd];
        real[odd] = real[even] - tr; imag[odd] = imag[even] - ti;
        real[even] += tr; imag[even] += ti;
        const nextR = wr * stepR - wi * stepI;
        wi = wr * stepI + wi * stepR; wr = nextR;
      }
    }
  }
}

function correlation(a, b) {
  const meanA = a.reduce((sum, v) => sum + v, 0) / 12;
  const meanB = b.reduce((sum, v) => sum + v, 0) / 12;
  let numerator = 0, normA = 0, normB = 0;
  for (let i = 0; i < 12; i++) {
    const x = a[i] - meanA, y = b[i] - meanB;
    numerator += x * y; normA += x * x; normB += y * y;
  }
  return numerator / (Math.sqrt(normA * normB) || 1);
}

// Estimate key from several short spectral snapshots; entirely on-device.
export function estimateKey(buffer) {
  const size = 4096, sampleRate = buffer.sampleRate;
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  const chroma = new Array(12).fill(0);
  const snapshots = [0.16, 0.34, 0.52, 0.70, 0.86];
  let used = 0;

  for (const position of snapshots) {
    const center = Math.floor(buffer.length * position);
    const start = Math.max(0, Math.min(buffer.length - size, center - size / 2));
    if (start < 0 || buffer.length < size) continue;
    const real = new Float64Array(size), imag = new Float64Array(size);
    for (let i = 0; i < size; i++) {
      let sample = 0;
      for (const channel of channels) sample += channel[start + i] || 0;
      sample /= channels.length || 1;
      const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (size - 1));
      real[i] = sample * window;
    }
    fft(real, imag);
    for (let bin = 2; bin < size / 2; bin++) {
      const frequency = bin * sampleRate / size;
      if (frequency < 55 || frequency > 2200) continue;
      const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
      const pitchClass = ((midi % 12) + 12) % 12;
      const magnitude = Math.hypot(real[bin], imag[bin]);
      // Mild weighting avoids bass fundamentals dominating the key estimate.
      chroma[pitchClass] += magnitude * Math.pow(frequency, 0.18);
    }
    used++;
  }
  if (!used || chroma.every(value => value === 0)) return { key: '', keyConfidence: 0 };

  const candidates = [];
  for (let tonic = 0; tonic < 12; tonic++) {
    const major = MAJOR.map((_, i) => chroma[(i + tonic) % 12]);
    const minor = MINOR.map((_, i) => chroma[(i + tonic) % 12]);
    candidates.push({ key: NOTE_NAMES[tonic] + ' major', score: correlation(major, MAJOR) });
    candidates.push({ key: NOTE_NAMES[tonic] + ' minor', score: correlation(minor, MINOR) });
  }
  candidates.sort((a, b) => b.score - a.score);
  const confidence = Math.max(0, Math.min(1, (candidates[0].score - candidates[1].score) * 2.5));
  return { key: candidates[0].key, keyConfidence: Math.round(confidence * 100) / 100 };
}

export function keyCompatibility(a, b) {
  if (!a || !b) return 0.5;
  const parse = value => {
    const match = /^(C♯|D♯|F♯|G♯|A♯|[A-G])\s+(major|minor)$/i.exec(value);
    if (!match) return null;
    return { tonic: NOTE_NAMES.indexOf(match[1]), mode: match[2].toLowerCase() };
  };
  const left = parse(a), right = parse(b);
  if (!left || !right) return 0.5;
  const distance = Math.min((left.tonic - right.tonic + 12) % 12, (right.tonic - left.tonic + 12) % 12);
  if (distance === 0 && left.mode === right.mode) return 0;
  if (distance === 0 || (distance === 3 && left.mode !== right.mode)) return 0.25;
  if (distance === 5 || distance === 7) return 0.45;
  if (distance === 2) return 0.65;
  return 1 + distance * 0.08;
}
