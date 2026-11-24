import {
  computeSingleSidedSpectrum,
  zeroPhaseBandPass,
  zeroPhaseComplexLowPass,
  zeroPhaseLowPass,
} from './fft';
import { SeededRandom } from './prng';
import {
  computeAutoBandwidths,
  EXPERIMENT_PRESETS,
  generateMessageSignal,
  getEffectiveMaxMessageFreqKhz,
  validateParameters,
} from './signals';
import {
  ExperimentSummaryRow,
  SensitivityPoint,
  SimulationParams,
  SimulationResult,
  SpectrumData,
  SystemMetrics,
  ThresholdPoint,
  ThresholdSweepConfig,
  ThresholdSweepResult,
} from './types';

function meanSlice(arr: Float64Array, start: number, end: number): number {
  let sum = 0;
  for (let i = start; i < end; i++) {
    sum += arr[i];
  }
  return sum / Math.max(1, end - start);
}

function powerSlice(arr: Float64Array, start: number, end: number): number {
  let sum = 0;
  for (let i = start; i < end; i++) {
    sum += arr[i] * arr[i];
  }
  return sum / Math.max(1, end - start);
}

/**
 * Align recovered waveform to original message (small lag search to compensate discrete
 * phase-difference 0.5-1 sample delay), remove DC, and normalize RMS amplitude.
 * Preserves physical demodulator polarity (never flips sign).
 */
function alignAndNormalizeRecovered(
  original: Float64Array,
  recoveredRaw: Float64Array,
  margin: number
): {
  recovered: Float64Array;
  error: Float64Array;
  outputSnrDb: number;
  nmse: number;
  nmsePercent: number;
  rmse: number;
  correlation: number;
  optimalLagSamples: number;
} {
  const n = original.length;
  const start = margin;
  const end = n - margin;
  const evalLen = Math.max(1, end - start);

  // DC removal on original and raw recovered over evaluation window
  const origMean = meanSlice(original, start, end);
  const recMean = meanSlice(recoveredRaw, start, end);

  const origZero = new Float64Array(n);
  const recZero = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    origZero[i] = original[i] - origMean;
    recZero[i] = recoveredRaw[i] - recMean;
  }

  // Find small lag in [-4, 4] maximizing positive cross-correlation
  let bestLag = 0;
  let bestCorrNum = -Infinity;
  const maxLag = 4;
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let dot = 0;
    for (let i = start; i < end; i++) {
      const j = i + lag;
      if (j >= 0 && j < n) {
        dot += origZero[i] * recZero[j];
      }
    }
    if (dot > bestCorrNum) {
      bestCorrNum = dot;
      bestLag = lag;
    }
  }

  // Shift recovered by bestLag
  const aligned = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const j = i + bestLag;
    aligned[i] = j >= 0 && j < n ? recZero[j] : 0;
  }

  // Re-center aligned over evaluation window & compute RMS scale
  const alignedMean = meanSlice(aligned, start, end);
  let pOrig = 0;
  let pRec = 0;
  for (let i = start; i < end; i++) {
    const a = aligned[i] - alignedMean;
    const m = origZero[i];
    pOrig += m * m;
    pRec += a * a;
  }
  pOrig /= evalLen;
  pRec /= evalLen;

  const rmsScale = pRec > 1e-18 ? Math.sqrt(pOrig / pRec) : 0;
  const recovered = new Float64Array(n);
  const error = new Float64Array(n);

  let pErr = 0;
  let crossSum = 0;
  for (let i = 0; i < n; i++) {
    const rVal = (aligned[i] - alignedMean) * rmsScale + origMean;
    recovered[i] = rVal;
    error[i] = original[i] - rVal;
  }

  for (let i = start; i < end; i++) {
    const e = error[i];
    pErr += e * e;
    crossSum += origZero[i] * (recovered[i] - origMean);
  }
  pErr /= evalLen;

  const correlation =
    pOrig > 1e-18 ? crossSum / (evalLen * pOrig) : 0;

  const nmse = pOrig > 1e-18 ? pErr / pOrig : 1;
  const rmse = Math.sqrt(Math.max(0, pErr));

  let outputSnrDb: number;
  if (pErr <= 1e-14 * Math.max(pOrig, 1e-12)) {
    outputSnrDb = 80;
  } else {
    outputSnrDb = 10 * Math.log10(Math.max(pOrig, 1e-18) / pErr);
  }

  return {
    recovered,
    error,
    outputSnrDb,
    nmse,
    nmsePercent: nmse * 100,
    rmse,
    correlation: Math.max(-1, Math.min(1, correlation)),
    optimalLagSamples: bestLag,
  };
}

/**
 * Estimate occupied RF bandwidth around carrier capturing `powerFraction` (e.g. 0.98) of passband power.
 */
function measureOccupiedBandwidthKhz(
  spectrum: SpectrumData,
  fcKhz: number,
  searchHalfSpanKhz: number,
  powerFraction: number
): number {
  const { freqsKhz, magnitude } = spectrum;
  const len = freqsKhz.length;
  const fLow = Math.max(0, fcKhz - searchHalfSpanKhz);
  const fHigh = fcKhz + searchHalfSpanKhz;

  // Find carrier bin
  let totalPower = 0;
  let fcIdx = 0;
  let minFcDist = Infinity;
  for (let k = 0; k < len; k++) {
    const f = freqsKhz[k];
    const d = Math.abs(f - fcKhz);
    if (d < minFcDist) {
      minFcDist = d;
      fcIdx = k;
    }
    if (f >= fLow && f <= fHigh) {
      totalPower += magnitude[k] * magnitude[k];
    }
  }
  if (totalPower <= 1e-18) return 0;

  // Expand symmetrically from carrier until powerFraction is captured
  let acc = magnitude[fcIdx] * magnitude[fcIdx];
  let offset = 1;
  while (acc / totalPower < powerFraction) {
    let added = false;
    if (fcIdx - offset >= 0 && freqsKhz[fcIdx - offset] >= fLow) {
      acc += magnitude[fcIdx - offset] * magnitude[fcIdx - offset];
      added = true;
    }
    if (fcIdx + offset < len && freqsKhz[fcIdx + offset] <= fHigh) {
      acc += magnitude[fcIdx + offset] * magnitude[fcIdx + offset];
      added = true;
    }
    if (!added) break;
    offset++;
  }

  const df = len > 1 ? freqsKhz[1] - freqsKhz[0] : 0;
  return 2 * offset * df;
}

/**
 * Run a full AM + FM numerical simulation.
 * Set `skipSpectra = true` during Monte Carlo threshold sweeps for rapid computation.
 */
export function runSimulation(
  inputParams: SimulationParams,
  options?: { skipSpectra?: boolean; overrideNumSamples?: number }
): SimulationResult {
  const params: SimulationParams = {
    ...inputParams,
    numSamples: options?.overrideNumSamples ?? inputParams.numSamples,
  };

  const validation = validateParameters(params);
  const autoBw = computeAutoBandwidths(params);

  const effectiveMu = params.allowOvermodulation
    ? params.amModIndex
    : Math.min(1.0, params.amModIndex);
  const isOvermodulated = effectiveMu > 1.0;
  const fmBeta = params.fmFreqDeviationKhz / Math.max(0.001, params.messageFreqKhz);
  const effectiveMaxMessageFreqKhz = getEffectiveMaxMessageFreqKhz(
    params.messageWaveform,
    params.messageFreqKhz
  );

  const amIfBw = params.autoIfBandwidth
    ? autoBw.amIfBandwidthKhz
    : params.amIfBandwidthKhz;
  const fmIfBw = params.autoIfBandwidth
    ? autoBw.fmIfBandwidthKhz
    : params.fmIfBandwidthKhz;
  const audioLpfKhz = params.autoIfBandwidth
    ? autoBw.audioLpfKhz
    : params.audioLpfCutoffKhz;

  const n = params.numSamples;
  const fsHz = params.samplingFreqKhz * 1000;
  const fcHz = params.carrierFreqKhz * 1000;
  const deltaFHz = params.fmFreqDeviationKhz * 1000;
  const ac = params.carrierAmplitude;
  const alpha = params.channelAttenuation;
  const margin = Math.max(32, Math.floor(n * 0.06));

  // 1. Common Message Signal
  const { timeMs, message, messageNormalized } = generateMessageSignal(params);

  // 2. AM Modulation: s_AM(t) = Ac [1 + mu * m_norm(t)] cos(2*pi*fc*t)
  const amModulated = new Float64Array(n);
  const amEnvelopeTheoretical = new Float64Array(n);
  let amEnvMax = -Infinity;
  let amEnvMin = Infinity;

  // 3. FM Modulation: s_FM(t) = Ac cos(2*pi*fc*t + 2*pi*delta_f * integral(m_norm(tau) dtau))
  const fmModulated = new Float64Array(n);
  let phaseIntegral = 0;
  const twoPiFc = 2 * Math.PI * fcHz;
  const twoPiDeltaFOverFs = (2 * Math.PI * deltaFHz) / fsHz;

  for (let i = 0; i < n; i++) {
    const tSec = i / fsHz;
    const carrierPhase = twoPiFc * tSec;

    // AM
    const env = ac * (1 + effectiveMu * messageNormalized[i]);
    amEnvelopeTheoretical[i] = env;
    if (env > amEnvMax) amEnvMax = env;
    if (env < amEnvMin) amEnvMin = env;
    amModulated[i] = env * Math.cos(carrierPhase);

    // FM (trapezoidal integration of messageNormalized)
    if (i > 0) {
      phaseIntegral +=
        0.5 * (messageNormalized[i - 1] + messageNormalized[i]) * twoPiDeltaFOverFs;
    }
    fmModulated[i] = ac * Math.cos(carrierPhase + phaseIntegral);
  }

  // 4. Comparable AWGN + Attenuation Channel
  // Both AM and FM receive independent AWGN draws with identical sigma (same N0/2 PSD)
  const rng = new SeededRandom(params.seed);
  const noiseAm = rng.generateAwgn(n, params.noiseSigma);
  const noiseFm = rng.generateAwgn(n, params.noiseSigma);

  const amReceivedNoisy = new Float64Array(n);
  const fmReceivedNoisy = new Float64Array(n);
  const amCleanRx = new Float64Array(n);
  const fmCleanRx = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    amCleanRx[i] = alpha * amModulated[i];
    fmCleanRx[i] = alpha * fmModulated[i];
    amReceivedNoisy[i] = amCleanRx[i] + noiseAm[i];
    fmReceivedNoisy[i] = fmCleanRx[i] + noiseFm[i];
  }

  // 5. AM Demodulation (Optional IF Bandpass -> Rectification -> Envelope LPF)
  let amIfFiltered: Float64Array;
  let amNoiseIfEnbwKhz = params.samplingFreqKhz * 0.5;
  if (params.ifFilterEnabled) {
    const bp = zeroPhaseBandPass(
      amReceivedNoisy,
      params.samplingFreqKhz,
      params.carrierFreqKhz,
      amIfBw
    );
    amIfFiltered = bp.filtered;
    amNoiseIfEnbwKhz = bp.enbwKhz;
  } else {
    amIfFiltered = amReceivedNoisy;
  }

  const amRectified = new Float64Array(n);
  if (params.amRectifierMode === 'full_wave') {
    for (let i = 0; i < n; i++) {
      amRectified[i] = Math.abs(amIfFiltered[i]);
    }
  } else {
    for (let i = 0; i < n; i++) {
      amRectified[i] = amIfFiltered[i] > 0 ? amIfFiltered[i] : 0;
    }
  }

  const amEnvelopeLpf = zeroPhaseLowPass(
    amRectified,
    params.samplingFreqKhz,
    audioLpfKhz
  );
  const amEval = alignAndNormalizeRecovered(message, amEnvelopeLpf, margin);

  // 6. FM Demodulation (Optional IF Bandpass -> Quadrature Analytic Downconversion ->
  //    Conjugate Phase-Difference Discriminator -> Post-Detection Audio LPF)
  let fmIfFiltered: Float64Array;
  let fmNoiseIfEnbwKhz = params.samplingFreqKhz * 0.5;
  if (params.ifFilterEnabled) {
    const bp = zeroPhaseBandPass(
      fmReceivedNoisy,
      params.samplingFreqKhz,
      params.carrierFreqKhz,
      fmIfBw
    );
    fmIfFiltered = bp.filtered;
    fmNoiseIfEnbwKhz = bp.enbwKhz;
  } else {
    fmIfFiltered = fmReceivedNoisy;
  }

  // Downconvert to complex baseband I/Q
  const iRaw = new Float64Array(n);
  const qRaw = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const carrierPhase = twoPiFc * (i / fsHz);
    const s = fmIfFiltered[i];
    iRaw[i] = 2 * s * Math.cos(carrierPhase);
    qRaw[i] = -2 * s * Math.sin(carrierPhase);
  }

  // Complex baseband LPF to cleanly strip 2*fc image while preserving IF signal+noise bandwidth
  const iqCutoffKhz = params.ifFilterEnabled
    ? Math.min(params.carrierFreqKhz * 0.85, Math.max(fmIfBw * 0.6, effectiveMaxMessageFreqKhz * 2))
    : Math.min(params.carrierFreqKhz * 0.85, params.samplingFreqKhz * 0.4);
  const { iOut, qOut } = zeroPhaseComplexLowPass(
    iRaw,
    qRaw,
    params.samplingFreqKhz,
    iqCutoffKhz
  );

  // Instantaneous frequency discriminator via complex conjugate phase difference:
  // f_dev[k] = (fs / 2*pi) * atan2(Q[k]*I[k-1] - I[k]*Q[k-1], I[k]*I[k-1] + Q[k]*Q[k-1])
  const fmInstFreq = new Float64Array(n);
  const scaleFreq = fsHz / (2 * Math.PI);
  for (let i = 1; i < n; i++) {
    const iCurr = iOut[i];
    const qCurr = qOut[i];
    const iPrev = iOut[i - 1];
    const qPrev = qOut[i - 1];
    const imagPart = qCurr * iPrev - iCurr * qPrev;
    const realPart = iCurr * iPrev + qCurr * qPrev;
    fmInstFreq[i] = Math.atan2(imagPart, realPart) * scaleFreq;
  }
  fmInstFreq[0] = fmInstFreq[1];

  const fmDemodLpf = zeroPhaseLowPass(
    fmInstFreq,
    params.samplingFreqKhz,
    audioLpfKhz
  );
  const fmEval = alignAndNormalizeRecovered(message, fmDemodLpf, margin);

  // 7. Compute Rigorous Channel SNR & IF CNR Metrics
  const evalEnd = n - margin;
  const pRxAm = powerSlice(amCleanRx, margin, evalEnd);
  const pRxFm = powerSlice(fmCleanRx, margin, evalEnd);
  const pNoiseFullAm = Math.max(1e-18, powerSlice(noiseAm, margin, evalEnd));
  const pNoiseFullFm = Math.max(1e-18, powerSlice(noiseFm, margin, evalEnd));

  // Measure actual filtered noise power inside the IF filter for exact experimental CNR
  let pNoiseIfAm = pNoiseFullAm;
  let pNoiseIfFm = pNoiseFullFm;
  if (params.ifFilterEnabled) {
    const nAmBp = zeroPhaseBandPass(
      noiseAm,
      params.samplingFreqKhz,
      params.carrierFreqKhz,
      amIfBw
    );
    const nFmBp = zeroPhaseBandPass(
      noiseFm,
      params.samplingFreqKhz,
      params.carrierFreqKhz,
      fmIfBw
    );
    pNoiseIfAm = Math.max(1e-18, powerSlice(nAmBp.filtered, margin, evalEnd));
    pNoiseIfFm = Math.max(1e-18, powerSlice(nFmBp.filtered, margin, evalEnd));
  }

  const nyquistKhz = params.samplingFreqKhz * 0.5;
  const pNoiseBasebandAm = Math.max(
    1e-18,
    pNoiseFullAm * (effectiveMaxMessageFreqKhz / nyquistKhz)
  );
  const pNoiseBasebandFm = Math.max(
    1e-18,
    pNoiseFullFm * (effectiveMaxMessageFreqKhz / nyquistKhz)
  );

  const amMetrics: SystemMetrics = {
    channelSnrDb: 10 * Math.log10(Math.max(pRxAm, 1e-18) / pNoiseFullAm),
    ifCnrDb: 10 * Math.log10(Math.max(pRxAm, 1e-18) / pNoiseIfAm),
    basebandRefSnrDb: 10 * Math.log10(Math.max(pRxAm, 1e-18) / pNoiseBasebandAm),
    outputSnrDb: amEval.outputSnrDb,
    nmse: amEval.nmse,
    nmsePercent: amEval.nmsePercent,
    rmse: amEval.rmse,
    correlation: amEval.correlation,
    optimalLagSamples: amEval.optimalLagSamples,
    bandwidthKhz: autoBw.amBandwidthKhz,
    ifBandwidthUsedKhz: params.ifFilterEnabled ? amNoiseIfEnbwKhz : nyquistKhz,
    receivedPowerW: pRxAm,
    noisePowerIfW: pNoiseIfAm,
  };

  const fmMetrics: SystemMetrics = {
    channelSnrDb: 10 * Math.log10(Math.max(pRxFm, 1e-18) / pNoiseFullFm),
    ifCnrDb: 10 * Math.log10(Math.max(pRxFm, 1e-18) / pNoiseIfFm),
    basebandRefSnrDb: 10 * Math.log10(Math.max(pRxFm, 1e-18) / pNoiseBasebandFm),
    outputSnrDb: fmEval.outputSnrDb,
    nmse: fmEval.nmse,
    nmsePercent: fmEval.nmsePercent,
    rmse: fmEval.rmse,
    correlation: fmEval.correlation,
    optimalLagSamples: fmEval.optimalLagSamples,
    bandwidthKhz: autoBw.fmCarsonBandwidthKhz,
    ifBandwidthUsedKhz: params.ifFilterEnabled ? fmNoiseIfEnbwKhz : nyquistKhz,
    receivedPowerW: pRxFm,
    noisePowerIfW: pNoiseIfFm,
  };

  // 8. Spectra (skipped only inside fast Monte Carlo sweep loops)
  let messageSpectrum: SpectrumData;
  let amSpectrum: SpectrumData;
  let fmSpectrum: SpectrumData;
  let amMeasuredBandwidth99Khz = autoBw.amBandwidthKhz;
  let fmMeasuredBandwidth98Khz = autoBw.fmCarsonBandwidthKhz;

  if (options?.skipSpectra) {
    const empty = new Float64Array(0);
    messageSpectrum = { freqsKhz: empty, magnitude: empty, magnitudeDb: empty };
    amSpectrum = { freqsKhz: empty, magnitude: empty, magnitudeDb: empty };
    fmSpectrum = { freqsKhz: empty, magnitude: empty, magnitudeDb: empty };
  } else {
    messageSpectrum = computeSingleSidedSpectrum(message, params.samplingFreqKhz, true);
    amSpectrum = computeSingleSidedSpectrum(amModulated, params.samplingFreqKhz, true);
    fmSpectrum = computeSingleSidedSpectrum(fmModulated, params.samplingFreqKhz, true);
    amMeasuredBandwidth99Khz = measureOccupiedBandwidthKhz(
      amSpectrum,
      params.carrierFreqKhz,
      Math.max(autoBw.amBandwidthKhz * 1.5, 20),
      0.99
    );
    fmMeasuredBandwidth98Khz = measureOccupiedBandwidthKhz(
      fmSpectrum,
      params.carrierFreqKhz,
      Math.max(autoBw.fmCarsonBandwidthKhz * 1.2, 40),
      0.98
    );
  }

  return {
    params,
    validation,
    timeMs,
    durationMs: (n / fsHz) * 1000,
    freqResolutionHz: fsHz / n,
    effectiveMu,
    isOvermodulated,
    fmBeta,
    amBandwidthKhz: autoBw.amBandwidthKhz,
    fmCarsonBandwidthKhz: autoBw.fmCarsonBandwidthKhz,
    effectiveMaxMessageFreqKhz,
    message,
    messageNormalized,
    amModulated,
    amEnvelopeTheoretical,
    amReceivedNoisy,
    amIfFiltered,
    amRecovered: amEval.recovered,
    amError: amEval.error,
    fmModulated,
    fmReceivedNoisy,
    fmIfFiltered,
    fmRecovered: fmEval.recovered,
    fmError: fmEval.error,
    messageSpectrum,
    amSpectrum,
    fmSpectrum,
    amMetrics,
    fmMetrics,
    amMeasuredMaxEnvelope: amEnvMax,
    amMeasuredMinEnvelope: amEnvMin,
    amMeasuredBandwidth99Khz,
    fmMeasuredBandwidth98Khz,
  };
}

/**
 * Compute required AWGN sigma (V) to achieve a target FM IF CNR (dB)
 * under the current carrier amplitude, attenuation, and FM IF bandwidth.
 */
export function computeSigmaForTargetCnr(
  params: SimulationParams,
  targetFmIfCnrDb: number
): number {
  const autoBw = computeAutoBandwidths(params);
  const fmIfBw = params.ifFilterEnabled
    ? params.autoIfBandwidth
      ? autoBw.fmIfBandwidthKhz
      : params.fmIfBandwidthKhz
    : params.samplingFreqKhz * 0.5;

  const pCarrier = 0.5 * Math.pow(params.carrierAmplitude * params.channelAttenuation, 2);
  const cnrLinear = Math.pow(10, targetFmIfCnrDb / 10);
  const pNoiseIf = pCarrier / Math.max(1e-9, cnrLinear);
  const nyquistKhz = params.samplingFreqKhz * 0.5;
  const sigmaSq = pNoiseIf * (nyquistKhz / Math.max(1, fmIfBw));
  return Math.sqrt(Math.max(0, sigmaSq));
}

/**
 * Run Monte Carlo FM Threshold Sweep across input CNR values using the actual
 * implemented AM & FM demodulators. Experimentally detects the threshold knee
 * where FM output SNR deviates from its linear above-threshold slope.
 */
export function runThresholdSweep(
  baseParams: SimulationParams,
  config: ThresholdSweepConfig
): ThresholdSweepResult {
  const autoBw = computeAutoBandwidths(baseParams);
  const fmIfBw = baseParams.ifFilterEnabled
    ? baseParams.autoIfBandwidth
      ? autoBw.fmIfBandwidthKhz
      : baseParams.fmIfBandwidthKhz
    : baseParams.samplingFreqKhz * 0.5;
  const amIfBw = baseParams.ifFilterEnabled
    ? baseParams.autoIfBandwidth
      ? autoBw.amIfBandwidthKhz
      : baseParams.amIfBandwidthKhz
    : baseParams.samplingFreqKhz * 0.5;

  const sweepSamples = Math.min(baseParams.numSamples, 4096);
  const step = Math.max(0.5, Math.abs(config.stepDb));
  const trials = Math.max(1, Math.min(20, Math.round(config.trialsPerPoint)));

  const cnrValues: number[] = [];
  for (let cnr = config.cnrMaxDb; cnr >= config.cnrMinDb - 1e-6; cnr -= step) {
    cnrValues.push(Number(cnr.toFixed(2)));
  }

  const rawPoints: Omit<ThresholdPoint, 'regime'>[] = [];

  for (let idx = 0; idx < cnrValues.length; idx++) {
    const targetCnr = cnrValues[idx];
    const sigma = computeSigmaForTargetCnr(baseParams, targetCnr);

    const fmSnrs: number[] = [];
    const amSnrs: number[] = [];
    let fmNmseSum = 0;
    let amNmseSum = 0;
    let fmRmseSum = 0;
    let amRmseSum = 0;
    let measuredFmCnrSum = 0;
    let measuredAmCnrSum = 0;

    for (let t = 0; t < trials; t++) {
      const trialSeed = config.baseSeed + idx * 997 + t * 37;
      const res = runSimulation(
        {
          ...baseParams,
          noiseSigma: sigma,
          seed: trialSeed,
        },
        { skipSpectra: true, overrideNumSamples: sweepSamples }
      );
      fmSnrs.push(res.fmMetrics.outputSnrDb);
      amSnrs.push(res.amMetrics.outputSnrDb);
      fmNmseSum += res.fmMetrics.nmsePercent;
      amNmseSum += res.amMetrics.nmsePercent;
      fmRmseSum += res.fmMetrics.rmse;
      amRmseSum += res.amMetrics.rmse;
      measuredFmCnrSum += res.fmMetrics.ifCnrDb;
      measuredAmCnrSum += res.amMetrics.ifCnrDb;
    }

    const fmMean = fmSnrs.reduce((a, b) => a + b, 0) / trials;
    const amMean = amSnrs.reduce((a, b) => a + b, 0) / trials;
    const fmStd = Math.sqrt(
      fmSnrs.reduce((a, v) => a + (v - fmMean) * (v - fmMean), 0) / trials
    );
    const amStd = Math.sqrt(
      amSnrs.reduce((a, v) => a + (v - amMean) * (v - amMean), 0) / trials
    );

    rawPoints.push({
      inputCnrDb: measuredFmCnrSum / trials,
      amIfCnrDb: measuredAmCnrSum / trials,
      fmOutputSnrDb: fmMean,
      fmOutputSnrStdDb: fmStd,
      amOutputSnrDb: amMean,
      amOutputSnrStdDb: amStd,
      fmNmsePercent: fmNmseSum / trials,
      amNmsePercent: amNmseSum / trials,
      fmRmse: fmRmseSum / trials,
      amRmse: amRmseSum / trials,
    });
  }

  // Sort ascending by input CNR for clean plotting & slope analysis
  rawPoints.sort((a, b) => a.inputCnrDb - b.inputCnrDb);

  // Experimentally detect FM threshold knee from measured curve slope & deviation:
  // 1. Find the steepest local slope d(SNR_out)/d(CNR) (where click noise triggers collapse).
  // 2. Fit the linear above-threshold reference offset over points well above the steepest cliff
  //    (where local slope is close to 1 dB/dB).
  // 3. Identify the threshold knee as the upper inflection of the steep drop (where measured
  //    FM Output SNR departs >= 2.5 dB below the linear above-threshold trend, or where slope exceeds 1.7 dB/dB).
  let detectedThresholdCnrDb: number | null = null;
  let thresholdBandLowDb: number | null = null;
  let thresholdBandHighDb: number | null = null;
  let maxSlope = 0;

  if (rawPoints.length >= 5) {
    const slopes: number[] = new Array(rawPoints.length).fill(1);
    let steepestIdx = -1;
    for (let i = 1; i < rawPoints.length; i++) {
      const dCnr = rawPoints[i].inputCnrDb - rawPoints[i - 1].inputCnrDb;
      const dSnr = rawPoints[i].fmOutputSnrDb - rawPoints[i - 1].fmOutputSnrDb;
      const slope = dCnr > 0.25 ? dSnr / dCnr : 1;
      slopes[i] = slope;
      if (slope > maxSlope) {
        maxSlope = slope;
        steepestIdx = i;
      }
    }

    // Estimate above-threshold linear offset from points with healthy linear slope (0.65..1.45 dB/dB)
    // located above the steepest cliff
    const linearCandidates = rawPoints.filter((p, idx) => {
      if (idx <= Math.max(2, steepestIdx)) return false;
      const s = slopes[idx];
      return s >= 0.55 && s <= 1.5 && p.fmNmsePercent < 0.25;
    });

    const refSlice =
      linearCandidates.length >= 2
        ? linearCandidates
        : rawPoints.slice(Math.max(0, Math.floor(rawPoints.length * 0.65)));

    const avgOffset =
      refSlice.reduce((acc, p) => acc + (p.fmOutputSnrDb - p.inputCnrDb), 0) /
      Math.max(1, refSlice.length);

    // Find knee: walk upward from steepestIdx to the point where slope eases below 1.65 dB/dB
    // or deficit from linear asymptote drops below 2.5 dB
    let kneeIdx = -1;
    if (steepestIdx >= 1 && maxSlope >= 1.65) {
      kneeIdx = steepestIdx;
      while (
        kneeIdx < rawPoints.length - 1 &&
        (slopes[kneeIdx + 1] > 1.65 ||
          rawPoints[kneeIdx].inputCnrDb + avgOffset - rawPoints[kneeIdx].fmOutputSnrDb > 2.5)
      ) {
        kneeIdx++;
      }
    } else {
      // Fallback: deficit check from top down
      for (let i = rawPoints.length - 2; i >= 0; i--) {
        const deficit = rawPoints[i].inputCnrDb + avgOffset - rawPoints[i].fmOutputSnrDb;
        if (deficit >= 3.0) {
          kneeIdx = i;
          break;
        }
      }
    }

    if (kneeIdx >= 0) {
      detectedThresholdCnrDb = rawPoints[kneeIdx].inputCnrDb;
      thresholdBandHighDb = rawPoints[Math.min(rawPoints.length - 1, kneeIdx + 1)].inputCnrDb;
      thresholdBandLowDb =
        rawPoints[Math.max(0, Math.min(kneeIdx - 1, steepestIdx - 1))].inputCnrDb;
    }
  }

  const points: ThresholdPoint[] = rawPoints.map((p) => {
    let regime: 'above' | 'near' | 'below' = 'above';
    if (thresholdBandLowDb !== null && thresholdBandHighDb !== null) {
      if (p.inputCnrDb < thresholdBandLowDb) {
        regime = 'below';
      } else if (p.inputCnrDb <= thresholdBandHighDb + 1.0) {
        regime = 'near';
      } else {
        regime = 'above';
      }
    }
    return { ...p, regime };
  });

  return {
    config,
    points,
    detectedThresholdCnrDb,
    thresholdBandLowDb,
    thresholdBandHighDb,
    maxSlopeDbPerDb: maxSlope,
    fmBeta: baseParams.fmFreqDeviationKhz / Math.max(0.001, baseParams.messageFreqKhz),
    fmIfBandwidthKhz: fmIfBw,
    amIfBandwidthKhz: amIfBw,
  };
}

/**
 * Automated 3-Experiment Summary Generator:
 * Runs Experiment 1 (Clean), Experiment 2 (Moderate), and Experiment 3 (Weak)
 * back-to-back with identical message/carrier/seed settings.
 */
export function runThreeExperimentSummary(
  baseParams: SimulationParams
): ExperimentSummaryRow[] {
  return EXPERIMENT_PRESETS.map((preset) => {
    const res = runSimulation(
      {
        ...baseParams,
        ...preset.patch,
      },
      { skipSpectra: true }
    );
    const diff = res.fmMetrics.outputSnrDb - res.amMetrics.outputSnrDb;
    const winner: 'AM' | 'FM' | 'Tie' =
      Math.abs(diff) < 0.5 ? 'Tie' : diff > 0 ? 'FM' : 'AM';

    return {
      id: preset.id,
      label: preset.name,
      noiseSigma: res.params.noiseSigma,
      attenuation: res.params.channelAttenuation,
      amIfCnrDb: res.amMetrics.ifCnrDb,
      fmIfCnrDb: res.fmMetrics.ifCnrDb,
      amOutputSnrDb: res.amMetrics.outputSnrDb,
      fmOutputSnrDb: res.fmMetrics.outputSnrDb,
      amNmsePercent: res.amMetrics.nmsePercent,
      fmNmsePercent: res.fmMetrics.nmsePercent,
      amRmse: res.amMetrics.rmse,
      fmRmse: res.fmMetrics.rmse,
      winner,
    };
  });
}

/**
 * Sensitivity sweep for AM modulation index mu (0.2 to 1.4, demonstrating both
 * SNR gain up to mu=1.0 and overmodulation collapse for mu > 1.0).
 */
export function runAmModIndexSweep(baseParams: SimulationParams): SensitivityPoint[] {
  const muValues = [0.2, 0.35, 0.5, 0.65, 0.8, 0.95, 1.0, 1.15, 1.3, 1.45];
  const sweepSamples = Math.min(baseParams.numSamples, 4096);
  return muValues.map((mu) => {
    const res = runSimulation(
      {
        ...baseParams,
        amModIndex: mu,
        allowOvermodulation: true,
      },
      { skipSpectra: true, overrideNumSamples: sweepSamples }
    );
    return {
      paramValue: mu,
      outputSnrDb: res.amMetrics.outputSnrDb,
      nmsePercent: res.amMetrics.nmsePercent,
      bandwidthKhz: res.amBandwidthKhz,
    };
  });
}

/**
 * Sensitivity sweep for FM frequency deviation delta_f (4 kHz to 36 kHz,
 * showing the SNR improvement vs Carson bandwidth trade-off).
 */
export function runFmDeviationSweep(baseParams: SimulationParams): SensitivityPoint[] {
  const maxSafeDev = Math.max(
    12,
    Math.min(40, Math.floor(baseParams.carrierFreqKhz * 0.45 - baseParams.messageFreqKhz))
  );
  const steps = 9;
  const minDev = 4;
  const sweepSamples = Math.min(baseParams.numSamples, 4096);
  const out: SensitivityPoint[] = [];

  for (let i = 0; i < steps; i++) {
    const dev = Number((minDev + ((maxSafeDev - minDev) * i) / (steps - 1)).toFixed(1));
    const res = runSimulation(
      {
        ...baseParams,
        fmFreqDeviationKhz: dev,
        autoIfBandwidth: true,
      },
      { skipSpectra: true, overrideNumSamples: sweepSamples }
    );
    out.push({
      paramValue: dev,
      outputSnrDb: res.fmMetrics.outputSnrDb,
      nmsePercent: res.fmMetrics.nmsePercent,
      bandwidthKhz: res.fmCarsonBandwidthKhz,
    });
  }
  return out;
}
