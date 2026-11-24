import React, { useState } from 'react';
import { FileSpreadsheet, PlayCircle } from 'lucide-react';
import { downloadCsv } from '../dsp/exportUtils';
import { EXPERIMENT_PRESETS, WAVEFORM_META } from '../dsp/signals';
import { runThreeExperimentSummary } from '../dsp/simulator';
import {
  ExperimentPresetId,
  ExperimentSummaryRow,
  SimulationResult,
} from '../dsp/types';
import { AudioConsole } from './AudioConsole';
import { OscilloscopePlot } from './OscilloscopePlot';

interface OverviewTabProps {
  result: SimulationResult;
  activePreset: ExperimentPresetId;
  isDark: boolean;
  onSelectPreset: (presetId: Exclude<ExperimentPresetId, 'custom'>) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  result,
  activePreset,
  isDark,
  onSelectPreset,
}) => {
  const [summaryRows, setSummaryRows] = useState<ExperimentSummaryRow[] | null>(null);

  const handleGenerateSummary = () => {
    const rows = runThreeExperimentSummary(result.params);
    setSummaryRows(rows);
  };

  const handleExportSummaryCsv = () => {
    if (!summaryRows) return;
    downloadCsv(
      'am_fm_three_experiment_summary',
      [
        'Experiment',
        'Noise Sigma (V)',
        'Attenuation (alpha)',
        'AM IF CNR (dB)',
        'FM IF CNR (dB)',
        'AM Output SNR (dB)',
        'FM Output SNR (dB)',
        'AM NMSE (%)',
        'FM NMSE (%)',
        'AM RMSE (V)',
        'FM RMSE (V)',
        'Higher Output SNR',
      ],
      summaryRows.map((r) => [
        r.label,
        r.noiseSigma.toFixed(4),
        r.attenuation.toFixed(2),
        r.amIfCnrDb.toFixed(2),
        r.fmIfCnrDb.toFixed(2),
        r.amOutputSnrDb.toFixed(2),
        r.fmOutputSnrDb.toFixed(2),
        r.amNmsePercent.toFixed(3),
        r.fmNmsePercent.toFixed(3),
        r.amRmse.toFixed(4),
        r.fmRmse.toFixed(4),
        r.winner,
      ])
    );
  };

  const defaultWindowMs: [number, number] = [
    0,
    Math.min(result.durationMs, Math.max(1.0, 6 / Math.max(1, result.params.messageFreqKhz))),
  ];

  const activePresetInfo = EXPERIMENT_PRESETS.find((p) => p.id === activePreset);
  const snrDelta = result.fmMetrics.outputSnrDb - result.amMetrics.outputSnrDb;

  return (
    <div className="space-y-6">
      {/* Header & Experiment Context */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
            Laboratory Overview
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
            {activePresetInfo
              ? activePresetInfo.description
              : 'Custom channel and modulation configuration running identical message signals through comparable AWGN channels.'}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
          <span>N = {result.params.numSamples}</span>
          <span aria-hidden="true">·</span>
          <span>T = {result.durationMs.toFixed(2)} ms</span>
          <span aria-hidden="true">·</span>
          <span>Δf_bin = {result.freqResolutionHz.toFixed(1)} Hz</span>
        </div>
      </div>

      {/* Primary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1420] rounded-md p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            AM Output SNR
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-mono font-semibold tabular-nums text-amber-600 dark:text-amber-400">
              {result.amMetrics.outputSnrDb.toFixed(2)}
            </span>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">dB</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            <span>IF CNR: {result.amMetrics.ifCnrDb.toFixed(1)} dB</span>
            <span>NMSE: {result.amMetrics.nmsePercent.toFixed(2)}%</span>
          </div>
        </div>

        <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1420] rounded-md p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            FM Output SNR
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-mono font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {result.fmMetrics.outputSnrDb.toFixed(2)}
            </span>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">dB</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            <span>IF CNR: {result.fmMetrics.ifCnrDb.toFixed(1)} dB</span>
            <span>NMSE: {result.fmMetrics.nmsePercent.toFixed(2)}%</span>
          </div>
        </div>

        <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1420] rounded-md p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            FM vs AM SNR Advantage
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span
              className={`text-2xl font-mono font-semibold tabular-nums ${
                snrDelta >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {snrDelta >= 0 ? '+' : ''}
              {snrDelta.toFixed(2)}
            </span>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">dB</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            {Math.abs(snrDelta) < 0.5
              ? 'Comparable recovered fidelity'
              : snrDelta > 0
                ? 'FM outperforms AM (above threshold)'
                : 'AM outperforms FM (FM below threshold)'}
          </div>
        </div>

        <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1420] rounded-md p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Transmission Bandwidths
          </div>
          <div className="mt-1.5 flex items-baseline gap-2 font-mono tabular-nums">
            <span className="text-lg font-semibold text-amber-600 dark:text-amber-400">
              {result.amBandwidthKhz.toFixed(1)}
            </span>
            <span className="text-xs text-slate-400">vs</span>
            <span className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
              {result.fmCarsonBandwidthKhz.toFixed(1)}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">kHz</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            <span>μ = {result.effectiveMu.toFixed(2)}</span>
            <span>β = {result.fmBeta.toFixed(2)}</span>
            <span>Ratio: {(result.fmCarsonBandwidthKhz / Math.max(0.1, result.amBandwidthKhz)).toFixed(1)}×</span>
          </div>
        </div>
      </div>

      {/* Audio Playback Console */}
      <AudioConsole result={result} />

      {/* Side-by-Side AM vs FM Recovered Waveform Comparison */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <OscilloscopePlot
          title="AM Recovered vs Original Message"
          subtitle={`Envelope detector · Output SNR ${result.amMetrics.outputSnrDb.toFixed(2)} dB`}
          series={[
            {
              label: 'Original m(t)',
              x: result.timeMs,
              y: result.message,
              colorDark: '#22D3EE',
              colorLight: '#0284C7',
              lineWidth: 1.5,
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
          ]}
          xLabel="Time (ms)"
          yLabel="Amplitude (V)"
          xUnit="ms"
          yUnit="V"
          initialXRange={defaultWindowMs}
          height={250}
          isDark={isDark}
          exportFilename="overview_am_recovered"
        />

        <OscilloscopePlot
          title="FM Recovered vs Original Message"
          subtitle={`Quadrature discriminator · Output SNR ${result.fmMetrics.outputSnrDb.toFixed(2)} dB`}
          series={[
            {
              label: 'Original m(t)',
              x: result.timeMs,
              y: result.message,
              colorDark: '#22D3EE',
              colorLight: '#0284C7',
              lineWidth: 1.5,
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
          ]}
          xLabel="Time (ms)"
          yLabel="Amplitude (V)"
          xUnit="ms"
          yUnit="V"
          initialXRange={defaultWindowMs}
          height={250}
          isDark={isDark}
          exportFilename="overview_fm_recovered"
        />
      </div>

      {/* Active Simulation Parameter Ledger */}
      <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1420] rounded-md overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            Active Simulation Configuration
          </h2>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            {WAVEFORM_META[result.params.messageWaveform].formula}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800 text-xs">
          {[
            { label: 'Message Freq (fm)', val: `${result.params.messageFreqKhz.toFixed(2)} kHz` },
            { label: 'Carrier Freq (fc)', val: `${result.params.carrierFreqKhz.toFixed(1)} kHz` },
            { label: 'Sampling Rate (fs)', val: `${result.params.samplingFreqKhz.toFixed(0)} kHz` },
            { label: 'AM Index (μ)', val: `${result.effectiveMu.toFixed(2)} (${(result.effectiveMu * 100).toFixed(0)}%)` },
            { label: 'FM Dev / Index (β)', val: `${result.params.fmFreqDeviationKhz.toFixed(1)} kHz / ${result.fmBeta.toFixed(2)}` },
            { label: 'AWGN σ / Rx α', val: `${result.params.noiseSigma.toFixed(3)} V / ${result.params.channelAttenuation.toFixed(2)}` },
          ].map((item) => (
            <div key={item.label} className="p-3">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">{item.label}</div>
              <div className="mt-1 font-mono font-medium tabular-nums text-slate-900 dark:text-slate-100">
                {item.val}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Automated 3-Experiment Summary Generator */}
      <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1420] rounded-md overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Automated 3-Experiment Summary Generator
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Runs Clean Signal, Moderate Noise, and Weak Signal sequentially using your current message, carrier, and seed parameters.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleGenerateSummary}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-cyan-600 hover:bg-cyan-500 text-white transition-colors whitespace-nowrap cursor-pointer"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              <span>Run All 3 Experiments</span>
            </button>

            {summaryRows && (
              <button
                type="button"
                onClick={handleExportSummaryCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            )}
          </div>
        </div>

        {summaryRows ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17] text-slate-600 dark:text-slate-400">
                  <th className="py-2.5 px-4 font-semibold">Experiment</th>
                  <th className="py-2.5 px-3 font-semibold text-right">σ (V) / α</th>
                  <th className="py-2.5 px-3 font-semibold text-right">AM IF CNR</th>
                  <th className="py-2.5 px-3 font-semibold text-right">FM IF CNR</th>
                  <th className="py-2.5 px-3 font-semibold text-right">AM Out SNR</th>
                  <th className="py-2.5 px-3 font-semibold text-right">FM Out SNR</th>
                  <th className="py-2.5 px-3 font-semibold text-right">AM NMSE</th>
                  <th className="py-2.5 px-3 font-semibold text-right">FM NMSE</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono tabular-nums">
                {summaryRows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-2.5 px-4 font-sans font-medium text-slate-900 dark:text-slate-100">
                      {row.label}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                      {row.noiseSigma.toFixed(3)} / {row.attenuation.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                      {row.amIfCnrDb.toFixed(2)} dB
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                      {row.fmIfCnrDb.toFixed(2)} dB
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-amber-600 dark:text-amber-400">
                      {row.amOutputSnrDb.toFixed(2)} dB
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                      {row.fmOutputSnrDb.toFixed(2)} dB
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                      {row.amNmsePercent.toFixed(2)}%
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                      {row.fmNmsePercent.toFixed(2)}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-sans">
                      {row.id !== 'custom' && (
                        <button
                          type="button"
                          onClick={() => {
                            if (row.id !== 'custom') {
                              onSelectPreset(row.id);
                            }
                          }}
                          className="text-cyan-700 dark:text-cyan-400 hover:underline font-medium cursor-pointer"
                        >
                          Load
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5 text-xs text-slate-500 dark:text-slate-400">
            Click <strong className="text-slate-700 dark:text-slate-200">Run All 3 Experiments</strong> to compute and tabulate side-by-side numerical performance across Clean Signal, Moderate Noise, and Weak Signal conditions for your report.
          </div>
        )}
      </div>
    </div>
  );
};
