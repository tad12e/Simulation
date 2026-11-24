import {
  ExperimentPresetId,
  MessageWaveform,
  ParameterValidation,
  SimulationParams,
} from './types';

export const DEFAULT_SIMULATION_PARAMS: SimulationParams = {
  messageWaveform: 'sinusoid',
  messageFreqKhz: 4.0,
  messageAmplitude: 1.0,

  carrierFreqKhz: 100.0,
  samplingFreqKhz: 1024.0,
  carrierAmplitude: 1.0,
  numSamples: 8192,

  amModIndex: 0.7,
  allowOvermodulation: false,
  fmFreqDeviationKhz: 20.0,

  noiseSigma: 0.04,
  channelAttenuation: 1.0,
  seed: 2026,

  ifFilterEnabled: true,
  amIfBandwidthKhz: 12.0,
  fmIfBandwidthKhz: 48.0,
  autoIfBandwidth: true,
  audioLpfCutoffKhz: 6.5,
  amRectifierMode: 'full_wave',
};

export interface ExperimentPreset {
  id: Exclude<ExperimentPresetId, 'custom'>;
  name: string;
  shortLabel: string;
  description: string;
  patch: Partial<SimulationParams>;
}

export const EXPERIMENT_PRESETS: ExperimentPreset[] = [
  {
    id: 'clean',
    name: 'Experiment 1: Clean Signal',
    shortLabel: 'Clean Signal',
    description:
      'Very low AWGN and full received carrier strength to verify near-ideal AM envelope and FM discriminator recovery.',
    patch: {
      noiseSigma: 0.035,
      channelAttenuation: 1.0,
      ifFilterEnabled: true,
      autoIfBandwidth: true,
    },
  },
  {
    id: 'moderate',
    name: 'Experiment 2: Moderate Noise',
    shortLabel: 'Moderate Noise',
    description:
      'Moderate AWGN with nominal received carrier strength. Operates above FM threshold to compare wideband FM noise immunity against AM.',
    patch: {
      noiseSigma: 0.42,
      channelAttenuation: 0.85,
      ifFilterEnabled: true,
      autoIfBandwidth: true,
    },
  },
  {
    id: 'weak',
    name: 'Experiment 3: Weak Signal',
    shortLabel: 'Weak Signal',
    description:
      'Attenuated carrier under elevated AWGN, driving the FM receiver into the below-threshold region where phase clicks rapidly degrade output SNR.',
    patch: {
      noiseSigma: 0.62,
      channelAttenuation: 0.28,
      ifFilterEnabled: true,
      autoIfBandwidth: true,
    },
  },
];

export const WAVEFORM_META: Record<
  MessageWaveform,
  { label: string; formula: string; maxHarmonicMultiplier: number }
> = {
  sinusoid: {
    label: 'Single-Tone Sinusoid',
    formula: 'm(t) = Am cos(2π fm t)',
    maxHarmonicMultiplier: 1.0,
  },
  dual_tone: {
    label: 'Dual-Tone Composite',
    formula: 'm(t) = Am [0.65 cos(2π fm t) + 0.35 cos(2π (1.5 fm) t)]',
    maxHarmonicMultiplier: 1.5,
  },
  multi_tone: {
    label: 'Three-Tone Audio Chord',
    formula:
      'm(t) = Am [0.55 cos(2π fm t) + 0.30 cos(2π (1.25 fm) t) + 0.15 cos(2π (1.75 fm) t)]',
    maxHarmonicMultiplier: 1.75,
  },
  bandlimited_triangle: {
    label: 'Bandlimited Harmonic Wave',
    formula:
      'm(t) = Am norm(cos(2π fm t) − (1/9) cos(6π fm t) + (1/25) cos(10π fm t))',
    maxHarmonicMultiplier: 3.0,
  },
};

export function getEffectiveMaxMessageFreqKhz(
  waveform: MessageWaveform,
  fmKhz: number
): number {
  return fmKhz * WAVEFORM_META[waveform].maxHarmonicMultiplier;
}

/**
 * Compute optimal default IF bandwidths for AM (DSB + margin) and FM (Carson's Rule + 20% skirt margin)
 * plus a realistic audio baseband LPF that passes 2*fm so AM overmodulation distortion is preserved.
 */
export function computeAutoBandwidths(params: SimulationParams): {
  amBandwidthKhz: number;
  fmCarsonBandwidthKhz: number;
  amIfBandwidthKhz: number;
  fmIfBandwidthKhz: number;
  audioLpfKhz: number;
} {
  const fmMax = getEffectiveMaxMessageFreqKhz(
    params.messageWaveform,
    params.messageFreqKhz
  );
  const amBandwidthKhz = 2 * fmMax;
  const fmCarsonBandwidthKhz = 2 * (params.fmFreqDeviationKhz + fmMax);

  const amIfBandwidthKhz = Math.max(amBandwidthKhz * 1.4, amBandwidthKhz + 3.5);
  const fmIfBandwidthKhz = Math.min(
    params.carrierFreqKhz * 1.4,
    Math.max(fmCarsonBandwidthKhz * 1.22, 14.0)
  );
  const audioLpfKhz = Math.min(
    params.carrierFreqKhz * 0.35,
    Math.max(fmMax * 2.55, 10.5)
  );

  return {
    amBandwidthKhz,
    fmCarsonBandwidthKhz,
    amIfBandwidthKhz,
    fmIfBandwidthKhz,
    audioLpfKhz,
  };
}

/**
 * Validate parameter combinations for Nyquist safety, baseband separation, and overmodulation.
 */
export function validateParameters(params: SimulationParams): ParameterValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  const fmMax = getEffectiveMaxMessageFreqKhz(
    params.messageWaveform,
    params.messageFreqKhz
  );
  const fmHalfCarson = params.fmFreqDeviationKhz + fmMax;
  const nyquist = params.samplingFreqKhz / 2;

  if (params.messageFreqKhz <= 0 || params.carrierFreqKhz <= 0 || params.samplingFreqKhz <= 0) {
    errors.push('Frequencies must be strictly positive.');
  }
  if (params.messageAmplitude <= 0 || params.carrierAmplitude <= 0) {
    errors.push('Message and carrier amplitudes must be strictly positive.');
  }
  if (params.channelAttenuation <= 0 || params.channelAttenuation > 1.5) {
    errors.push('Channel attenuation factor must be within (0, 1.5].');
  }

  const maxRfFreq = params.carrierFreqKhz + fmHalfCarson;
  if (maxRfFreq >= nyquist * 0.95) {
    errors.push(
      `Nyquist violation: fc + Δf + fm_max (${maxRfFreq.toFixed(1)} kHz) approaches or exceeds fs/2 (${nyquist.toFixed(1)} kHz). Increase sampling rate or lower carrier/deviation.`
    );
  } else if (maxRfFreq >= nyquist * 0.8) {
    warnings.push(
      `Upper FM sidebands (${maxRfFreq.toFixed(1)} kHz) are close to Nyquist (${nyquist.toFixed(1)} kHz). Consider higher sampling frequency.`
    );
  }

  if (params.carrierFreqKhz <= fmHalfCarson * 1.15) {
    errors.push(
      `Baseband fold-over risk: Carrier fc (${params.carrierFreqKhz.toFixed(1)} kHz) must exceed Δf + fm_max (${fmHalfCarson.toFixed(1)} kHz) with guard margin.`
    );
  } else if (params.carrierFreqKhz < fmMax * 5) {
    warnings.push(
      `Carrier frequency (${params.carrierFreqKhz.toFixed(1)} kHz) is relatively close to message bandwidth (${fmMax.toFixed(1)} kHz); envelope ripple may increase.`
    );
  }

  if (params.messageFreqKhz < 3.0 || params.messageFreqKhz > 5.0) {
    warnings.push(
      `Message frequency (${params.messageFreqKhz.toFixed(2)} kHz) is outside the 3–5 kHz assignment nominal range.`
    );
  }

  if (params.amModIndex > 1.0 && params.allowOvermodulation) {
    warnings.push(
      `AM overmodulation active (μ = ${params.amModIndex.toFixed(2)} > 1.0): envelope phase reversal will cause non-linear demodulation distortion.`
    );
  }

  if (!params.autoIfBandwidth && params.ifFilterEnabled) {
    const carson = 2 * (params.fmFreqDeviationKhz + fmMax);
    if (params.fmIfBandwidthKhz < carson * 0.75) {
      warnings.push(
        `Manual FM IF bandwidth (${params.fmIfBandwidthKhz.toFixed(1)} kHz) is narrower than Carson's Rule (${carson.toFixed(1)} kHz), which will truncate FM sidebands and add distortion.`
      );
    }
    if (params.amIfBandwidthKhz < 2 * fmMax) {
      warnings.push(
        `Manual AM IF bandwidth (${params.amIfBandwidthKhz.toFixed(1)} kHz) is narrower than 2·fm (${(2 * fmMax).toFixed(1)} kHz) and will attenuate AM sidebands.`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Generate the identical common message signal m(t) and normalized m_norm(t)
 * used by both AM and FM transmitters.
 */
export function generateMessageSignal(params: SimulationParams): {
  timeMs: Float64Array;
  message: Float64Array;
  messageNormalized: Float64Array;
} {
  const n = params.numSamples;
  const fsHz = params.samplingFreqKhz * 1000;
  const fmHz = params.messageFreqKhz * 1000;
  const amp = params.messageAmplitude;

  const timeMs = new Float64Array(n);
  const raw = new Float64Array(n);

  let maxAbs = 0;
  const twoPiFm = 2 * Math.PI * fmHz;

  for (let i = 0; i < n; i++) {
    const tSec = i / fsHz;
    timeMs[i] = tSec * 1000;
    const phase = twoPiFm * tSec;

    let val = 0;
    switch (params.messageWaveform) {
      case 'sinusoid':
        val = Math.cos(phase);
        break;
      case 'dual_tone':
        val = 0.65 * Math.cos(phase) + 0.35 * Math.cos(1.5 * phase);
        break;
      case 'multi_tone':
        val =
          0.55 * Math.cos(phase) +
          0.3 * Math.cos(1.25 * phase) +
          0.15 * Math.cos(1.75 * phase);
        break;
      case 'bandlimited_triangle':
        // Odd harmonics up to 3rd for realistic bandlimited triangle-like waveform
        val =
          Math.cos(phase) -
          (1 / 9) * Math.cos(3 * phase) +
          (1 / 25) * Math.cos(5 * phase);
        break;
    }

    raw[i] = val;
    const a = Math.abs(val);
    if (a > maxAbs) maxAbs = a;
  }

  const message = new Float64Array(n);
  const messageNormalized = new Float64Array(n);
  const normFactor = maxAbs > 1e-12 ? 1 / maxAbs : 1;

  for (let i = 0; i < n; i++) {
    const normVal = raw[i] * normFactor;
    messageNormalized[i] = normVal;
    message[i] = normVal * amp;
  }

  return { timeMs, message, messageNormalized };
}
