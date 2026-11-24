import React, { useState } from 'react';
import { SimulationParams, SimulationResult } from '../dsp/types';
import { AudioConsole } from './AudioConsole';
import { OscilloscopePlot, ShadedRegion, VerticalMarker } from './OscilloscopePlot';

interface FmSimulationTabProps {
  result: SimulationResult;
  isDark: boolean;
  onChangeParams: (patch: Partial<SimulationParams>) => void;
}

export const FmSimulationTab: React.FC<FmSimulationTabProps> = ({
  result,
  isDark,
  onChangeParams,
}) => {
  const [spectrumScale, setSpectrumScale] = useState<'linear' | 'db'>('linear');
  const [showErrorTrace, setShowErrorTrace] = useState(false);

  const msgWindowMs: [number, number] = [
    0,
    Math.min(result.durationMs, Math.max(1.0, 5 / Math.max(1, result.params.messageFreqKhz))),
  ];
  // Zoomed carrier window (~1.5 message cycles) so instantaneous frequency compression/expansion is clearly visible
  const fmCarrierWindowMs: [number, number] = [
    0,
    Math.min(result.durationMs, Math.max(0.25, 1.5 / Math.max(1, result.params.messageFreqKhz))),
  ];

  const fc = result.params.carrierFreqKhz;
  const fm = result.params.messageFreqKhz;
  const carsonHalf = result.fmCarsonBandwidthKhz * 0.5;
  const fmSpecSpan = Math.max(30, carsonHalf * 1.65);
  const fmSpecRange: [number, number] = [
    Math.max(0, fc - fmSpecSpan),
    Math.min(result.params.samplingFreqKhz * 0.5, fc + fmSpecSpan),
  ];

  const msgSpecRange: [number, number] = [
    0,
    Math.min(result.params.samplingFreqKhz * 0.5, Math.max(20, result.effectiveMaxMessageFreqKhz * 3.5)),
  ];

  const fmMarkers: VerticalMarker[] = [
    { x: fc, label: `fc (${fc.toFixed(0)} kHz)`, colorDark: '#34D399', colorLight: '#059669' },
    {
      x: fc - result.params.fmFreqDeviationKhz,
      label: `fc−Δf`,
      colorDark: '#94A3B8',
      colorLight: '#64748B',
    },
    {
      x: fc + result.params.fmFreqDeviationKhz,
      label: `fc+Δf`,
      colorDark: '#94A3B8',
      colorLight: '#64748B',
    },
  ];

  const carsonShade: ShadedRegion[] = [
    {
      xStart: fc - carsonHalf,
      xEnd: fc + carsonHalf,
      label: `Carson BW ≈ ${result.fmCarsonBandwidthKhz.toFixed(1)} kHz`,
      fillDark: 'rgba(52, 211, 153, 0.08)',
      fillLight: 'rgba(5, 150, 105, 0.08)',
      textDark: '#34D399',
      textLight: '#047857',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
            Frequency Modulation (FM) Simulation
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Constant-envelope angle modulation{' '}
            <span className="font-mono text-xs text-slate-800 dark:text-slate-200">
              s_FM(t) = Ac cos[2π fc t + 2π kf ∫m(τ)dτ]
            </span>{' '}
            demodulated via analytic quadrature phase-difference discrimination.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
          <span>
            Δf = <strong className="text-emerald-600 dark:text-emerald-400">{result.params.fmFreqDeviationKhz.toFixed(1)} kHz</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            β = Δf/fm = <strong className="text-emerald-600 dark:text-emerald-400">{result.fmBeta.toFixed(2)}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Carson BW: <strong className="text-slate-900 dark:text-slate-100">{result.fmCarsonBandwidthKhz.toFixed(1)} kHz</strong>
          </span>
        </div>
      </div>

      {/* FM Metrics & Deviation Quick Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1420] rounded-md p-3.5">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">FM IF Input CNR</div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {result.fmMetrics.ifCnrDb.toFixed(2)} <span className="text-xs font-normal text-slate-500">dB</span>
          </div>
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
            IF ENBW: {result.fmMetrics.ifBandwidthUsedKhz.toFixed(1)} kHz
          </div>
        </div>

        <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1420] rounded-md p-3.5">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">FM Output SNR</div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {result.fmMetrics.outputSnrDb.toFixed(2)} <span className="text-xs font-normal text-slate-500">dB</span>
          </div>
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
            Corr ρ: {result.fmMetrics.correlation.toFixed(4)}
          </div>
        </div>

        <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1420] rounded-md p-3.5">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">Distortion (NMSE / RMSE)</div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {result.fmMetrics.nmsePercent.toFixed(3)}%
          </div>
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
            RMSE: {result.fmMetrics.rmse.toFixed(4)} V
          </div>
        </div>

        <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1420] rounded-md p-3.5 flex flex-col justify-between">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">Regime &amp; Deviation Preset</div>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              {result.fmBeta < 1 ? 'NBFM (β < 1)' : 'WBFM (β ≥ 1)'}
            </span>
            <div className="flex items-center gap-1">
              {[8, 20, 32].map((dev) => (
                <button
                  key={dev}
                  type="button"
                  onClick={() => onChangeParams({ fmFreqDeviationKhz: dev })}
                  className={`px-1.5 py-0.5 text-[11px] font-mono rounded border cursor-pointer ${
                    Math.abs(result.params.fmFreqDeviationKhz - dev) < 0.2
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {dev}k
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* A & B: Original Message & FM Modulated Carrier */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <OscilloscopePlot
          title="A. Original Message Signal m(t)"
          subtitle={`fm = ${fm.toFixed(2)} kHz · kf = ${(result.params.fmFreqDeviationKhz / Math.max(0.01, result.params.messageAmplitude)).toFixed(1)} kHz/V`}
          series={[
            {
              label: 'Message m(t)',
              x: result.timeMs,
              y: result.message,
              colorDark: '#22D3EE',
              colorLight: '#0284C7',
              lineWidth: 1.8,
            },
          ]}
          xLabel="Time (ms)"
          yLabel="Amplitude (V)"
          xUnit="ms"
          yUnit="V"
          initialXRange={msgWindowMs}
          height={230}
          isDark={isDark}
          exportFilename="fm_a_original_message"
        />

        <OscilloscopePlot
          title="B. Transmitted FM-Modulated Carrier s_FM(t)"
          subtitle={`Constant envelope Ac = ${result.params.carrierAmplitude.toFixed(2)} V · Zoomed to show frequency variation`}
          series={[
            {
              label: 's_FM(t)',
              x: result.timeMs,
              y: result.fmModulated,
              colorDark: '#34D399',
              colorLight: '#059669',
              lineWidth: 1.25,
            },
            {
              label: 'Message m(t) ref',
              x: result.timeMs,
              y: result.message,
              colorDark: '#22D3EE',
              colorLight: '#0284C7',
              lineWidth: 1.3,
              dashed: true,
            },
          ]}
          xLabel="Time (ms)"
          yLabel="Amplitude (V)"
          xUnit="ms"
          yUnit="V"
          initialXRange={fmCarrierWindowMs}
          height={230}
          isDark={isDark}
          exportFilename="fm_b_modulated_carrier"
        />
      </div>

      {/* C & D: Received Noisy FM & Recovered FM */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <OscilloscopePlot
          title="C. Received Noisy FM Signal r_FM(t)"
          subtitle={`α = ${result.params.channelAttenuation.toFixed(2)} · σ = ${result.params.noiseSigma.toFixed(3)} V`}
          series={[
            {
              label: 'Received Noisy r_FM(t)',
              x: result.timeMs,
              y: result.fmReceivedNoisy,
              colorDark: '#6EE7B7',
              colorLight: '#10B981',
              lineWidth: 1.0,
            },
          ]}
          xLabel="Time (ms)"
          yLabel="Amplitude (V)"
          xUnit="ms"
          yUnit="V"
          initialXRange={fmCarrierWindowMs}
          height={230}
          isDark={isDark}
          exportFilename="fm_c_received_noisy"
        />

        <OscilloscopePlot
          title="D. Recovered FM Demodulated Signal"
          subtitle={`Output SNR ${result.fmMetrics.outputSnrDb.toFixed(2)} dB · NMSE ${result.fmMetrics.nmsePercent.toFixed(2)}%`}
          series={[
            {
              label: 'Original m(t)',
              x: result.timeMs,
              y: result.message,
              colorDark: '#22D3EE',
              colorLight: '#0284C7',
              lineWidth: 1.4,
              dashed: true,
            },
            {
              label: 'FM Recovered',
              x: result.timeMs,
              y: result.fmRecovered,
              colorDark: '#34D399',
              colorLight: '#059669',
              lineWidth: 1.8,
            },
            ...(showErrorTrace
              ? [
                  {
                    label: 'Error e(t)',
                    x: result.timeMs,
                    y: result.fmError,
                    colorDark: '#FB7185',
                    colorLight: '#E11D48',
                    lineWidth: 1.2,
                  },
                ]
              : []),
          ]}
          xLabel="Time (ms)"
          yLabel="Amplitude (V)"
          xUnit="ms"
          yUnit="V"
          initialXRange={msgWindowMs}
          height={230}
          isDark={isDark}
          exportFilename="fm_d_recovered_message"
          headerRight={
            <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer mr-1">
              <input
                type="checkbox"
                checked={showErrorTrace}
                onChange={(e) => setShowErrorTrace(e.target.checked)}
                className="accent-rose-500 w-3 h-3 cursor-pointer"
              />
              <span>Show e(t)</span>
            </label>
          }
        />
      </div>

      {/* E. Frequency Spectra */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <OscilloscopePlot
          title="E1. Original Message Spectrum |M(f)|"
          subtitle="Baseband single-sided FFT (Hann windowed)"
          series={[
            {
              label: '|M(f)|',
              x: result.messageSpectrum.freqsKhz,
              y:
                spectrumScale === 'linear'
                  ? result.messageSpectrum.magnitude
                  : result.messageSpectrum.magnitudeDb,
              colorDark: '#22D3EE',
              colorLight: '#0284C7',
              lineWidth: 1.6,
              fillUnder: spectrumScale === 'linear',
            },
          ]}
          xLabel="Frequency (kHz)"
          yLabel={spectrumScale === 'linear' ? 'Magnitude (V)' : 'Magnitude (dBV)'}
          xUnit="kHz"
          yUnit={spectrumScale === 'linear' ? 'V' : 'dBV'}
          initialXRange={msgSpecRange}
          yRange={spectrumScale === 'db' ? [-90, 6] : undefined}
          markers={[
            { x: fm, label: `fm (${fm.toFixed(1)} kHz)`, colorDark: '#22D3EE', colorLight: '#0284C7' },
          ]}
          height={235}
          isDark={isDark}
          exportFilename="fm_e1_message_spectrum"
          headerRight={
            <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded overflow-hidden text-[11px] mr-1">
              <button
                type="button"
                onClick={() => setSpectrumScale('linear')}
                className={`px-2 py-0.5 cursor-pointer ${
                  spectrumScale === 'linear'
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Linear
              </button>
              <button
                type="button"
                onClick={() => setSpectrumScale('db')}
                className={`px-2 py-0.5 cursor-pointer ${
                  spectrumScale === 'db'
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                dB
              </button>
            </div>
          }
        />

        <OscilloscopePlot
          title="E2. FM Transmitted Spectrum |S_FM(f)|"
          subtitle={`Bessel sidebands J_n(β=${result.fmBeta.toFixed(2)}) · Measured 98% BW: ${result.fmMeasuredBandwidth98Khz.toFixed(1)} kHz`}
          series={[
            {
              label: '|S_FM(f)|',
              x: result.fmSpectrum.freqsKhz,
              y:
                spectrumScale === 'linear'
                  ? result.fmSpectrum.magnitude
                  : result.fmSpectrum.magnitudeDb,
              colorDark: '#34D399',
              colorLight: '#059669',
              lineWidth: 1.6,
              fillUnder: spectrumScale === 'linear',
            },
          ]}
          xLabel="Frequency (kHz)"
          yLabel={spectrumScale === 'linear' ? 'Magnitude (V)' : 'Magnitude (dBV)'}
          xUnit="kHz"
          yUnit={spectrumScale === 'linear' ? 'V' : 'dBV'}
          initialXRange={fmSpecRange}
          yRange={spectrumScale === 'db' ? [-90, 6] : undefined}
          markers={fmMarkers}
          shadedRegions={carsonShade}
          height={235}
          isDark={isDark}
          exportFilename="fm_e2_fm_spectrum"
        />
      </div>

      {/* Audio + Brief Theory */}
      <AudioConsole result={result} compact />

      <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1420] rounded-md p-4">
        <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
          FM Quadrature Discriminator Notes
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
          FM encodes information in the instantaneous frequency deviation{' '}
          <span className="font-mono text-slate-800 dark:text-slate-200">f_i(t) = fc + kf m(t)</span> while keeping the carrier envelope constant. In the receiver, an IF bandpass filter rejects out-of-band noise before quadrature downconversion produces the complex analytic envelope{' '}
          <span className="font-mono text-slate-800 dark:text-slate-200">z[k] = I[k] + jQ[k]</span>. The discriminator computes instantaneous frequency via{' '}
          <span className="font-mono text-slate-800 dark:text-slate-200">(fs / 2π) arg(z[k]·z*[k−1])</span>, trading extra RF bandwidth (<span className="font-mono text-slate-800 dark:text-slate-200">Carson BW ≈ 2(Δf + fm)</span>) for significant SNR gain whenever received CNR remains above threshold.
        </p>
      </div>
    </div>
  );
};
