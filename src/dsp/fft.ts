import { SpectrumData } from './types';

/**
 * In-place Radix-2 Cooley-Tukey FFT / IFFT.
 * Requires `re.length === im.length` and power-of-2 length.
 */
export function fftInPlace(
  re: Float64Array,
  im: Float64Array,
  inverse = false
): void {
  const n = re.length;
  if (n <= 1) return;

  // Bit-reversal permutation
  let j = 0;
  for (let i = 0; i < n; i++) {
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
    let m = n >> 1;
    while (m >= 1 && j >= m) {
      j -= m;
      m >>= 1;
    }
    j += m;
  }

  // Butterfly stages
  const sign = inverse ? 1 : -1;
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const angleStep = (sign * 2 * Math.PI) / size;
    const wStepRe = Math.cos(angleStep);
    const wStepIm = Math.sin(angleStep);

    for (let start = 0; start < n; start += size) {
      let wRe = 1.0;
      let wIm = 0.0;
      for (let k = 0; k < half; k++) {
        const idx1 = start + k;
        const idx2 = idx1 + half;

        const tRe = wRe * re[idx2] - wIm * im[idx2];
        const tIm = wRe * im[idx2] + wIm * re[idx2];

        re[idx2] = re[idx1] - tRe;
        im[idx2] = im[idx1] - tIm;
        re[idx1] += tRe;
        im[idx1] += tIm;

        const nextWRe = wRe * wStepRe - wIm * wStepIm;
        wIm = wRe * wStepIm + wIm * wStepRe;
        wRe = nextWRe;
      }
    }
  }

  if (inverse) {
    const invN = 1 / n;
    for (let i = 0; i < n; i++) {
      re[i] *= invN;
      im[i] *= invN;
    }
  }
}

/**
 * Compute single-sided amplitude spectrum (V) and dB spectrum with Hann windowing.
 * Coherent gain of Hann window (0.5) is compensated so a 1 V cosine produces a 1.0 V peak.
 */
export function computeSingleSidedSpectrum(
  signal: Float64Array,
  fsKhz: number,
  useHannWindow = true
): SpectrumData {
  const n = signal.length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);

  let coherentGain = 1.0;
  if (useHannWindow) {
    let winSum = 0;
    const factor = (2 * Math.PI) / n;
    for (let i = 0; i < n; i++) {
      const w = 0.5 * (1 - Math.cos(factor * i));
      re[i] = signal[i] * w;
      winSum += w;
    }
    coherentGain = winSum / n;
  } else {
    re.set(signal);
  }

  fftInPlace(re, im, false);

  const half = (n >> 1) + 1;
  const freqsKhz = new Float64Array(half);
  const magnitude = new Float64Array(half);
  const magnitudeDb = new Float64Array(half);

  const dfKhz = fsKhz / n;
  const scale = 1 / (n * coherentGain);

  for (let k = 0; k < half; k++) {
    freqsKhz[k] = k * dfKhz;
    const rawMag = Math.hypot(re[k], im[k]) * scale;
    const singleSided = k === 0 || k === half - 1 ? rawMag : 2 * rawMag;
    magnitude[k] = singleSided;
    magnitudeDb[k] =
      singleSided > 1e-6 ? 20 * Math.log10(singleSided) : -120;
  }

  return { freqsKhz, magnitude, magnitudeDb };
}

/**
 * Smooth raised-cosine frequency taper to avoid Gibbs ringing while maintaining
 * sharp zero-phase selectivity.
 */
function raisedCosineGain(distFromCenter: number, halfPass: number, transition: number): number {
  if (distFromCenter <= halfPass) return 1.0;
  if (distFromCenter >= halfPass + transition) return 0.0;
  const x = (distFromCenter - halfPass) / transition;
  return 0.5 * (1 + Math.cos(Math.PI * x));
}

/**
 * Zero-phase frequency-domain Low-Pass Filter with raised-cosine transition roll-off.
 */
export function zeroPhaseLowPass(
  signal: Float64Array,
  fsKhz: number,
  cutoffKhz: number,
  transitionRatio = 0.18
): Float64Array {
  const n = signal.length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  re.set(signal);

  fftInPlace(re, im, false);

  const dfKhz = fsKhz / n;
  const nyquist = fsKhz * 0.5;
  const clampedCutoff = Math.max(dfKhz, Math.min(cutoffKhz, nyquist * 0.96));
  const trans = Math.max(dfKhz * 2, clampedCutoff * transitionRatio);
  const passEdge = Math.max(0, clampedCutoff - trans * 0.5);

  for (let k = 0; k < n; k++) {
    const freq = k <= n / 2 ? k * dfKhz : (n - k) * dfKhz;
    const g = raisedCosineGain(freq, passEdge, trans);
    re[k] *= g;
    im[k] *= g;
  }

  fftInPlace(re, im, true);
  return re;
}

/**
 * Zero-phase frequency-domain Bandpass Filter centered at `centerFreqKhz`
 * with total passband width `bandwidthKhz`.
 * Also returns the exact equivalent noise bandwidth (ENBW) in kHz for accurate IF CNR math.
 */
export function zeroPhaseBandPass(
  signal: Float64Array,
  fsKhz: number,
  centerFreqKhz: number,
  bandwidthKhz: number,
  transitionRatio = 0.12
): { filtered: Float64Array; enbwKhz: number } {
  const n = signal.length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  re.set(signal);

  fftInPlace(re, im, false);

  const dfKhz = fsKhz / n;
  const halfBw = Math.max(dfKhz * 2, bandwidthKhz * 0.5);
  const trans = Math.max(dfKhz * 2, halfBw * transitionRatio);
  const halfPass = Math.max(dfKhz, halfBw - trans * 0.5);

  let powerGainSum = 0;
  for (let k = 0; k < n; k++) {
    const freq = k <= n / 2 ? k * dfKhz : (n - k) * dfKhz;
    const dist = Math.abs(freq - centerFreqKhz);
    const g = raisedCosineGain(dist, halfPass, trans);
    re[k] *= g;
    im[k] *= g;
    if (k > 0 && k < n / 2) {
      powerGainSum += g * g;
    }
  }

  fftInPlace(re, im, true);
  const enbwKhz = Math.max(dfKhz, powerGainSum * dfKhz);
  return { filtered: re, enbwKhz };
}

/**
 * Zero-phase Complex Low-Pass Filter for quadrature I/Q baseband signals.
 */
export function zeroPhaseComplexLowPass(
  iSig: Float64Array,
  qSig: Float64Array,
  fsKhz: number,
  cutoffKhz: number,
  transitionRatio = 0.15
): { iOut: Float64Array; qOut: Float64Array } {
  const n = iSig.length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  re.set(iSig);
  im.set(qSig);

  fftInPlace(re, im, false);

  const dfKhz = fsKhz / n;
  const nyquist = fsKhz * 0.5;
  const clampedCutoff = Math.max(dfKhz * 2, Math.min(cutoffKhz, nyquist * 0.92));
  const trans = Math.max(dfKhz * 2, clampedCutoff * transitionRatio);
  const passEdge = Math.max(0, clampedCutoff - trans * 0.5);

  for (let k = 0; k < n; k++) {
    const freq = k <= n / 2 ? k * dfKhz : (n - k) * dfKhz;
    const g = raisedCosineGain(freq, passEdge, trans);
    re[k] *= g;
    im[k] *= g;
  }

  fftInPlace(re, im, true);
  return { iOut: re, qOut: im };
}
