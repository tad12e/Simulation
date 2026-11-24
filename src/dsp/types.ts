export type MessageWaveform =
  | 'sinusoid'
  | 'dual_tone'
  | 'multi_tone'
  | 'bandlimited_triangle';

export type RectifierMode = 'full_wave' | 'half_wave';

export type ExperimentPresetId = 'clean' | 'moderate' | 'weak' | 'custom';

export type TabId =
  | 'overview'
  | 'am'
  | 'fm'
  | 'threshold'
  | 'comparison'
  | 'validation';

export interface SimulationParams {
  // Message signal
  messageWaveform: MessageWaveform;
  messageFreqKhz: number; // Default 4.0 kHz (3–5 kHz recommended)
  messageAmplitude: number; // V (default 1.0 V)

  // Carrier & Sampling
  carrierFreqKhz: number; // Default 100 kHz
  samplingFreqKhz: number; // Default 1024 kHz
  carrierAmplitude: number; // Ac in V (default 1.0 V)
  numSamples: number; // Power of 2, default 8192 (8 ms at 1024 kHz)

  // Modulation parameters
  amModIndex: number; // mu, default 0.7 (clamped <= 1.0 unless allowOvermodulation)
  allowOvermodulation: boolean; // Default false
  fmFreqDeviationKhz: number; // delta_f in kHz, default 20 kHz (beta = 5.0 at 4 kHz)

  // Channel & Noise parameters
  noiseSigma: number; // AWGN sample RMS amplitude (V)
  channelAttenuation: number; // alpha in (0.05, 1.0]
  seed: number; // Deterministic PRNG seed

  // Receiver parameters
  ifFilterEnabled: boolean; // Adjustable IF bandpass filter before demodulation
  amIfBandwidthKhz: number; // Auto or custom AM IF bandwidth
  fmIfBandwidthKhz: number; // Auto (Carson's Rule) or custom FM IF bandwidth
  autoIfBandwidth: boolean; // Auto-track optimal Carson/DSB IF bandwidths
  audioLpfCutoffKhz: number; // Post-detection baseband low-pass filter cutoff
  amRectifierMode: RectifierMode;
}

export interface ParameterValidation {
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

export interface SpectrumData {
  freqsKhz: Float64Array;
  magnitude: Float64Array; // Linear single-sided peak amplitude (V)
  magnitudeDb: Float64Array; // 20*log10(mag) floored at -120 dB
}

export interface SystemMetrics {
  channelSnrDb: number; // Received RF signal power / full-band channel noise power
  ifCnrDb: number; // Received carrier power / noise power inside IF bandwidth
  basebandRefSnrDb: number; // Received signal power / noise power inside message baseband W
  outputSnrDb: number; // 10*log10(P_message / P_error) after DC removal, alignment & normalization
  nmse: number; // Normalized Mean Squared Error (ratio)
  nmsePercent: number; // NMSE * 100 (%)
  rmse: number; // Root Mean Squared Error (V)
  correlation: number; // Pearson correlation coefficient
  optimalLagSamples: number;
  bandwidthKhz: number; // Theoretical transmission bandwidth
  ifBandwidthUsedKhz: number;
  receivedPowerW: number;
  noisePowerIfW: number;
}

export interface SimulationResult {
  params: SimulationParams;
  validation: ParameterValidation;
  timeMs: Float64Array;
  durationMs: number;
  freqResolutionHz: number;

  // Derived modulation parameters
  effectiveMu: number;
  isOvermodulated: boolean;
  fmBeta: number; // beta = delta_f / f_m
  amBandwidthKhz: number; // 2 * f_m_max
  fmCarsonBandwidthKhz: number; // 2 * (delta_f + f_m_max)
  effectiveMaxMessageFreqKhz: number;

  // Core signals
  message: Float64Array; // m(t) in V
  messageNormalized: Float64Array; // m(t) / max|m|

  // AM signals
  amModulated: Float64Array;
  amEnvelopeTheoretical: Float64Array; // Ac * (1 + mu * m_norm)
  amReceivedNoisy: Float64Array;
  amIfFiltered: Float64Array;
  amRecovered: Float64Array; // DC removed, aligned, normalized to message RMS
  amError: Float64Array; // m(t) - amRecovered(t)

  // FM signals
  fmModulated: Float64Array;
  fmReceivedNoisy: Float64Array;
  fmIfFiltered: Float64Array;
  fmRecovered: Float64Array; // DC removed, aligned, normalized to message RMS
  fmError: Float64Array; // m(t) - fmRecovered(t)

  // Spectra
  messageSpectrum: SpectrumData;
  amSpectrum: SpectrumData;
  fmSpectrum: SpectrumData;

  // Performance metrics
  amMetrics: SystemMetrics;
  fmMetrics: SystemMetrics;

  // Measured envelope stats for mathematical validation
  amMeasuredMaxEnvelope: number;
  amMeasuredMinEnvelope: number;
  amMeasuredBandwidth99Khz: number;
  fmMeasuredBandwidth98Khz: number;
}

export interface ThresholdSweepConfig {
  cnrMaxDb: number; // e.g. 30
  cnrMinDb: number; // e.g. -2
  stepDb: number; // e.g. 2
  trialsPerPoint: number; // 1–20
  baseSeed: number;
}

export interface ThresholdPoint {
  inputCnrDb: number; // Reference FM IF CNR (dB)
  amIfCnrDb: number; // Comparable AM IF CNR (same N0/2)
  fmOutputSnrDb: number;
  fmOutputSnrStdDb: number;
  amOutputSnrDb: number;
  amOutputSnrStdDb: number;
  fmNmsePercent: number;
  amNmsePercent: number;
  fmRmse: number;
  amRmse: number;
  regime: 'above' | 'near' | 'below';
}

export interface ThresholdSweepResult {
  config: ThresholdSweepConfig;
  points: ThresholdPoint[];
  detectedThresholdCnrDb: number | null;
  thresholdBandLowDb: number | null;
  thresholdBandHighDb: number | null;
  maxSlopeDbPerDb: number;
  fmBeta: number;
  fmIfBandwidthKhz: number;
  amIfBandwidthKhz: number;
}

export interface ExperimentSummaryRow {
  id: ExperimentPresetId;
  label: string;
  noiseSigma: number;
  attenuation: number;
  amIfCnrDb: number;
  fmIfCnrDb: number;
  amOutputSnrDb: number;
  fmOutputSnrDb: number;
  amNmsePercent: number;
  fmNmsePercent: number;
  amRmse: number;
  fmRmse: number;
  winner: 'AM' | 'FM' | 'Tie';
}

export interface SensitivityPoint {
  paramValue: number;
  outputSnrDb: number;
  nmsePercent: number;
  bandwidthKhz: number;
}
