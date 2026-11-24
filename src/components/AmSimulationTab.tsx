import React, { useState } from 'react';
import { SimulationParams, SimulationResult } from '../dsp/types';
import { AudioConsole } from './AudioConsole';
import { OscilloscopePlot, VerticalMarker } from './OscilloscopePlot';

interface AmSimulationTabProps {
  result: SimulationResult;
  isDark: boolean;
  onChangeParams: (patch: Partial<SimulationParams>) => void;
}

export const AmSimulationTab: React.FC<AmSimulationTabProps> = ({
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
  const carrierWindowMs: [number, number] = [
    0,
    Math.min(result.durationMs, Math.max(0.5, 3 / Math.max(1, result.params.messageFreqKhz))),
  ];

  const fc = result.params.carrierFreqKhz;
  const fm = result.params.messageFreqKhz;
  const amSpecSpan = Math.max(20, result.amBandwidthKhz * 2.4);
  const amSpecRange: [number, number] = [
    Math.max(0, fc - amSpecSpan),
    Math.min(result.params.samplingFreqKhz * 0.5, fc + amSpecSpan),
  ];

  const msgSpecRange: [number, number] = [
    0,
    Math.min(result.params.samplingFreqKhz * 0.5, Math.max(20, result.effectiveMaxMessageFreqKhz * 3.5)),
  ];

  const amMarkers: VerticalMarker[] = [
    { x: fc, label: `fc (${fc.toFixed(0)} kHz)`, colorDark: '#F59E0B', colorLight: '#B45309' },
    { x: fc - fm, label: `LSB (${(fc - fm).toFixed(1)})`, colorDark: '#38BDF8', colorLight: '#0284C7' },
    { x: fc + fm, label: `USB (${(fc + fm).toFixed(1)})`, colorDark: '#38BDF8', colorLight: '#0284C7' },
  ];

  const amPercent = result.effectiveMu * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
            Amplitude Modulation (AM) Simulation
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Conventional DSB-LC modulation{' '}
            <span className="font-mono text-xs text-slate-800 dark:text-slate-200">
              s_AM(t) = Ac[1 + μ m(t)] cos(2π fc t)
            </span>{' '}
            with {result.params.amRectifierMode === 'full_wave' ? 'full-wave' : 'half-wave'} envelope detection.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
          <span>
            μ = <strong className="text-amber-600 dark:text-amber-400">{result.effectiveMu.toFixed(2)}</strong> ({amPercent.toFixed(0)}%)
          </span>
          <span aria-hidden="true">·</span>
          <span>
            E_max / E_min: <strong className="text-slate-900 dark:text-slate-100">{result.amMeasuredMaxEnvelope.toFixed(2)} / {result.amMeasuredMinEnvelope.toFixed(2)} V</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            BW_AM: <strong className="text-slate-900 dark:text-slate-100">{result.amBandwidthKhz.toFixed(1)} kHz</strong>
          </span>
        </div>
      </div>

      {/* AM Performance & Quick Control Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1420] rounded-md p-3.5">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">AM IF Input CNR</div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {result.amMetrics.ifCnrDb.toFixed(2)} <span className="text-xs font-normal text-slate-500">dB</span>
          </div>
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
            IF ENBW: {result.amMetrics.ifBandwidthUsedKhz.toFixed(1)} kHz
          </div>
        </div>

        <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1420] rounded-md p-3.5">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">AM Output SNR</div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-amber-600 dark:text-amber-400">
            {result.amMetrics.outputSnrDb.toFixed(2)} <span className="text-xs font-normal text-slate-500">dB</span>
          </div>
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
            Corr ρ: {result.amMetrics.correlation.toFixed(4)}
          </div>
        </div>

        <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1420] rounded-md p-3.5">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">Distortion (NMSE / RMSE)</div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {result.amMetrics.nmsePercent.toFixed(3)}%
          </div>
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
            RMSE: {result.amMetrics.rmse.toFixed(4)} V
          </div>
        </div>

        <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1420] rounded-md p-3.5 flex flex-col justify-between">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">Overmodulation Experiment</div>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span
              className={`text-xs font-semibold ${
                result.isOvermodulated
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {result.isOvermodulated ? '▲ Overmodulated' : '● Nominal (μ ≤ 1)'}
            </span>
            <button
              type="button"
              onClick={() => {
                if (result.isOvermodulated) {
                  onChangeParams({ allowOvermodulation: false, amModIndex: 0.7 });
                } else {
                  onChangeParams({ allowOvermodulation: true, amModIndex: 1.35 });
                }
              }}
              className="px-2 py-1 text-[11px] font-medium rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
            >
              {result.isOvermodulated ? 'Restore μ = 0.7' : 'Test μ = 1.35'}
            </button>
          </div>
        </div>
      </div>

      {/* A & B: Original Message & AM Modulated Carrier */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <OscilloscopePlot
          title="A. Original Message Signal m(t)"
          subtitle={`fm = ${result.params.messageFreqKhz.toFixed(2)} kHz · Am = ${result.params.messageAmplitude.toFixed(2)} V`}
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
          exportFilename="am_a_original_message"
        />

        <OscilloscopePlot
          title="B. Transmitted AM-Modulated Carrier s_AM(t)"
          subtitle={`fc = ${fc.toFixed(0)} kHz · μ = ${result.effectiveMu.toFixed(2)}`}
          series={[
            {
              label: 's_AM(t)',
              x: result.timeMs,
              y: result.amModulated,
              colorDark: '#F59E0B',
              colorLight: '#D97706',
              lineWidth: 1.15,
            },
            {
              label: 'Envelope Ac[1+μm(t)]',
              x: result.timeMs,
              y: result.amEnvelopeTheoretical,
              colorDark: '#22D3EE',
              colorLight: '#0284C7',
              lineWidth: 1.4,
              dashed: true,
            },
          ]}
          xLabel="Time (ms)"
          yLabel="Amplitude (V)"
          xUnit="ms"
          yUnit="V"
          initialXRange={carrierWindowMs}
          height={230}
          isDark={isDark}
          exportFilename="am_b_modulated_carrier"
        />
      </div>

      {/* C & D: Received Noisy AM & Recovered AM */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <OscilloscopePlot
          title="C. Received Noisy AM Signal r_AM(t)"
          subtitle={`α = ${result.params.channelAttenuation.toFixed(2)} · σ = ${result.params.noiseSigma.toFixed(3)} V`}
          series={[
            {
              label: 'Received Noisy r_AM(t)',
              x: result.timeMs,
              y: result.amReceivedNoisy,
              colorDark: '#FB923C',
              colorLight: '#EA580C',
              lineWidth: 1.0,
            },
          ]}
          xLabel="Time (ms)"
          yLabel="Amplitude (V)"
          xUnit="ms"
          yUnit="V"
          initialXRange={carrierWindowMs}
          height={230}
          isDark={isDark}
          exportFilename="am_c_received_noisy"
        />

        <OscilloscopePlot
          title="D. Recovered AM Demodulated Signal"
          subtitle={`Output SNR ${result.amMetrics.outputSnrDb.toFixed(2)} dB · NMSE ${result.amMetrics.nmsePercent.toFixed(2)}%`}
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
              label: 'AM Recovered',
              x: result.timeMs,
              y: result.amRecovered,
              colorDark: '#F59E0B',
              colorLight: '#D97706',
              lineWidth: 1.8,
            },
            ...(showErrorTrace
              ? [
                  {
                    label: 'Error e(t)',
                    x: result.timeMs,
                    y: result.amError,
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
          exportFilename="am_d_recovered_message"
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
          exportFilename="am_e1_message_spectrum"
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
          title="E2. AM Transmitted Spectrum |S_AM(f)|"
          subtitle={`Carrier at ${fc.toFixed(0)} kHz with LSB & USB sidebands`}
          series={[
            {
              label: '|S_AM(f)|',
              x: result.amSpectrum.freqsKhz,
              y:
                spectrumScale === 'linear'
                  ? result.amSpectrum.magnitude
                  : result.amSpectrum.magnitudeDb,
              colorDark: '#F59E0B',
              colorLight: '#D97706',
              lineWidth: 1.6,
              fillUnder: spectrumScale === 'linear',
            },
          ]}
          xLabel="Frequency (kHz)"
          yLabel={spectrumScale === 'linear' ? 'Magnitude (V)' : 'Magnitude (dBV)'}
          xUnit="kHz"
          yUnit={spectrumScale === 'linear' ? 'V' : 'dBV'}
          initialXRange={amSpecRange}
          yRange={spectrumScale === 'db' ? [-90, 6] : undefined}
          markers={amMarkers}
          height={235}
          isDark={isDark}
          exportFilename="am_e2_am_spectrum"
        />
      </div>

      {/* Audio + Brief Theory */}
      <AudioConsole result={result} compact />

      <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1420] rounded-md p-4">
        <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
          AM Envelope Detection Notes
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
          Conventional AM encodes the baseband message linearly into the instantaneous carrier envelope{' '}
          <span className="font-mono text-slate-800 dark:text-slate-200">Ac[1 + μ m(t)]</span>, occupying a double-sideband bandwidth of{' '}
          <span className="font-mono text-slate-800 dark:text-slate-200">BW_AM = 2 fm</span>. Provided{' '}
          <span className="font-mono text-slate-800 dark:text-slate-200">μ ≤ 1</span>, rectifying the IF-filtered signal and low-pass filtering cleanly extracts the envelope without requiring carrier phase synchronization. When{' '}
          <span className="font-mono text-slate-800 dark:text-slate-200">μ &gt; 1</span> (overmodulation), the envelope crosses zero and reverses carrier phase; the non-coherent rectifier folds negative excursions upward, creating severe harmonic distortion.
        </p>
      </div>
    </div>
  );
};
