import React, { useMemo } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { downloadCsv } from '../dsp/exportUtils';
import { runAmModIndexSweep, runFmDeviationSweep } from '../dsp/simulator';
import { SimulationResult } from '../dsp/types';
import { OscilloscopePlot } from './OscilloscopePlot';

interface ComparisonTabProps {
  result: SimulationResult;
  isDark: boolean;
}

export const ComparisonTab: React.FC<ComparisonTabProps> = ({ result, isDark }) => {
  // Run live parameter sensitivity sweeps under current channel conditions
  const amMuSweep = useMemo(
    () => runAmModIndexSweep(result.params),
    [result.params]
  );
  const fmDevSweep = useMemo(
    () => runFmDeviationSweep(result.params),
    [result.params]
  );

  const snrDiff = result.fmMetrics.outputSnrDb - result.amMetrics.outputSnrDb;
  const bwRatio =
    result.fmCarsonBandwidthKhz / Math.max(0.1, result.amBandwidthKhz);

  const amSnrGain = result.amMetrics.outputSnrDb - result.amMetrics.ifCnrDb;
  const fmSnrGain = result.fmMetrics.outputSnrDb - result.fmMetrics.ifCnrDb;

  // Dynamic engineering interpretation strictly grounded in current numerical results
  const interpretation = useMemo(() => {
    const lines: string[] = [];

    if (result.isOvermodulated) {
      lines.push(
        `AM is currently overmodulated (μ = ${result.effectiveMu.toFixed(2)} > 1.0), which causes envelope phase reversal and drives AM distortion to ${result.amMetrics.nmsePercent.toFixed(2)}% NMSE (Output SNR ${result.amMetrics.outputSnrDb.toFixed(2)} dB) regardless of channel noise.`
      );
    } else if (snrDiff > 2.0) {
      lines.push(
        `Under the current channel (σ = ${result.params.noiseSigma.toFixed(3)} V, α = ${result.params.channelAttenuation.toFixed(2)}), FM achieves an Output SNR of ${result.fmMetrics.outputSnrDb.toFixed(2)} dB versus ${result.amMetrics.outputSnrDb.toFixed(2)} dB for AM—a +${snrDiff.toFixed(2)} dB advantage. With FM IF CNR at ${result.fmMetrics.ifCnrDb.toFixed(1)} dB (above threshold) and β = ${result.fmBeta.toFixed(2)}, FM converts its ${bwRatio.toFixed(1)}× wider RF bandwidth into substantial noise immunity.`
      );
    } else if (snrDiff < -1.5) {
      lines.push(
        `At the current low FM IF CNR of ${result.fmMetrics.ifCnrDb.toFixed(1)} dB, the FM discriminator has entered the threshold breakdown region (Output SNR ${result.fmMetrics.outputSnrDb.toFixed(2)} dB, NMSE ${result.fmMetrics.nmsePercent.toFixed(2)}%). Conventional AM envelope detection degrades more gracefully (${result.amMetrics.outputSnrDb.toFixed(2)} dB, NMSE ${result.amMetrics.nmsePercent.toFixed(2)}%), outperforming FM by ${Math.abs(snrDiff).toFixed(2)} dB.`
      );
    } else {
      lines.push(
        `AM (${result.amMetrics.outputSnrDb.toFixed(2)} dB) and FM (${result.fmMetrics.outputSnrDb.toFixed(2)} dB) currently deliver comparable baseband fidelity (within ${Math.abs(snrDiff).toFixed(2)} dB), with NMSE of ${result.amMetrics.nmsePercent.toFixed(2)}% (AM) vs ${result.fmMetrics.nmsePercent.toFixed(2)}% (FM).`
      );
    }

    lines.push(
      `Spectral efficiency trade-off: AM requires only ${result.amBandwidthKhz.toFixed(1)} kHz (2·fm), whereas FM requires ${result.fmCarsonBandwidthKhz.toFixed(1)} kHz by Carson's Rule (2(Δf + fm)), occupying ${bwRatio.toFixed(2)}× more RF spectrum for β = ${result.fmBeta.toFixed(2)}.`
    );

    return lines;
  }, [result, snrDiff, bwRatio]);

  const handleExportComparisonCsv = () => {
    downloadCsv(
      'am_vs_fm_comparison',
      ['Metric', 'AM (DSB-LC)', 'FM (Angle Mod)', 'Difference / Ratio'],
      [
        [
          'Full-Band Channel SNR (dB)',
          result.amMetrics.channelSnrDb.toFixed(2),
          result.fmMetrics.channelSnrDb.toFixed(2),
          (result.fmMetrics.channelSnrDb - result.amMetrics.channelSnrDb).toFixed(2),
        ],
        [
          'IF Input CNR (dB)',
          result.amMetrics.ifCnrDb.toFixed(2),
          result.fmMetrics.ifCnrDb.toFixed(2),
          (result.fmMetrics.ifCnrDb - result.amMetrics.ifCnrDb).toFixed(2),
        ],
        [
          'Baseband Reference SNR (dB)',
          result.amMetrics.basebandRefSnrDb.toFixed(2),
          result.fmMetrics.basebandRefSnrDb.toFixed(2),
          (result.fmMetrics.basebandRefSnrDb - result.amMetrics.basebandRefSnrDb).toFixed(2),
        ],
        [
          'Recovered Output SNR (dB)',
          result.amMetrics.outputSnrDb.toFixed(2),
          result.fmMetrics.outputSnrDb.toFixed(2),
          snrDiff.toFixed(2),
        ],
        [
          'Demodulator Processing Gain (Out SNR - IF CNR, dB)',
          amSnrGain.toFixed(2),
          fmSnrGain.toFixed(2),
          (fmSnrGain - amSnrGain).toFixed(2),
        ],
        [
          'Distortion NMSE (%)',
          result.amMetrics.nmsePercent.toFixed(4),
          result.fmMetrics.nmsePercent.toFixed(4),
          (result.fmMetrics.nmsePercent - result.amMetrics.nmsePercent).toFixed(4),
        ],
        [
          'Distortion RMSE (V)',
          result.amMetrics.rmse.toFixed(5),
          result.fmMetrics.rmse.toFixed(5),
          (result.fmMetrics.rmse - result.amMetrics.rmse).toFixed(5),
        ],
        [
          'Pearson Correlation (rho)',
          result.amMetrics.correlation.toFixed(5),
          result.fmMetrics.correlation.toFixed(5),
          (result.fmMetrics.correlation - result.amMetrics.correlation).toFixed(5),
        ],
        [
          'Theoretical Bandwidth (kHz)',
          result.amBandwidthKhz.toFixed(2),
          result.fmCarsonBandwidthKhz.toFixed(2),
          `${bwRatio.toFixed(2)}x`,
        ],
        [
          'Measured Occupied Bandwidth (kHz)',
          result.amMeasuredBandwidth99Khz.toFixed(2),
          result.fmMeasuredBandwidth98Khz.toFixed(2),
          `${(result.fmMeasuredBandwidth98Khz / Math.max(0.1, result.amMeasuredBandwidth99Khz)).toFixed(2)}x`,
        ],
      ]
    );
  };

  const maxBw = Math.max(
    result.amBandwidthKhz,
    result.fmCarsonBandwidthKhz,
    result.fmMeasuredBandwidth98Khz,
    1
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
            AM vs FM Performance Comparison
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Direct quantitative comparison populated strictly from live numerical simulation outputs under identical source messages and comparable AWGN channels.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportComparisonCsv}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Export Table CSV</span>
        </button>
      </div>

      {/* Auto-Generated Engineering Interpretation */}
      <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1420] rounded-md p-4">
        <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
          Automated Engineering Interpretation (Current Run)
        </h2>
        <div className="mt-2 space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          {interpretation.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>
      </div>

      {/* Numerical Comparison Table */}
      <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1420] rounded-md overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            Measured System Metrics Comparison
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17] text-slate-600 dark:text-slate-400">
                <th className="py-2.5 px-4 font-semibold">Performance Metric</th>
                <th className="py-2.5 px-4 font-semibold text-right">AM (Envelope Det.)</th>
                <th className="py-2.5 px-4 font-semibold text-right">FM (Quadrature Disc.)</th>
                <th className="py-2.5 px-4 font-semibold text-right">FM vs AM Delta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono tabular-nums">
              {[
                {
                  name: 'Full-Band Channel SNR',
                  am: `${result.amMetrics.channelSnrDb.toFixed(2)} dB`,
                  fm: `${result.fmMetrics.channelSnrDb.toFixed(2)} dB`,
                  delta: `${(result.fmMetrics.channelSnrDb - result.amMetrics.channelSnrDb >= 0 ? '+' : '')}${(result.fmMetrics.channelSnrDb - result.amMetrics.channelSnrDb).toFixed(2)} dB`,
                },
                {
                  name: 'Pre-Detection IF Input CNR',
                  am: `${result.amMetrics.ifCnrDb.toFixed(2)} dB`,
                  fm: `${result.fmMetrics.ifCnrDb.toFixed(2)} dB`,
                  delta: `${(result.fmMetrics.ifCnrDb - result.amMetrics.ifCnrDb >= 0 ? '+' : '')}${(result.fmMetrics.ifCnrDb - result.amMetrics.ifCnrDb).toFixed(2)} dB`,
                },
                {
                  name: 'Baseband Reference SNR (P_rx / N0·W)',
                  am: `${result.amMetrics.basebandRefSnrDb.toFixed(2)} dB`,
                  fm: `${result.fmMetrics.basebandRefSnrDb.toFixed(2)} dB`,
                  delta: `${(result.fmMetrics.basebandRefSnrDb - result.amMetrics.basebandRefSnrDb >= 0 ? '+' : '')}${(result.fmMetrics.basebandRefSnrDb - result.amMetrics.basebandRefSnrDb).toFixed(2)} dB`,
                },
                {
                  name: 'Recovered Output SNR (10 log10 Pm/Pe)',
                  am: `${result.amMetrics.outputSnrDb.toFixed(2)} dB`,
                  fm: `${result.fmMetrics.outputSnrDb.toFixed(2)} dB`,
                  delta: `${snrDiff >= 0 ? '+' : ''}${snrDiff.toFixed(2)} dB`,
                  highlight: true,
                },
                {
                  name: 'Receiver Processing Gain (SNR_out − IF CNR)',
                  am: `${amSnrGain >= 0 ? '+' : ''}${amSnrGain.toFixed(2)} dB`,
                  fm: `${fmSnrGain >= 0 ? '+' : ''}${fmSnrGain.toFixed(2)} dB`,
                  delta: `${fmSnrGain - amSnrGain >= 0 ? '+' : ''}${(fmSnrGain - amSnrGain).toFixed(2)} dB`,
                },
                {
                  name: 'Normalized MSE (NMSE)',
                  am: `${result.amMetrics.nmsePercent.toFixed(3)}% (${result.amMetrics.nmse.toFixed(5)})`,
                  fm: `${result.fmMetrics.nmsePercent.toFixed(3)}% (${result.fmMetrics.nmse.toFixed(5)})`,
                  delta: `${result.fmMetrics.nmsePercent - result.amMetrics.nmsePercent >= 0 ? '+' : ''}${(result.fmMetrics.nmsePercent - result.amMetrics.nmsePercent).toFixed(3)}%`,
                },
                {
                  name: 'Root Mean Squared Error (RMSE)',
                  am: `${result.amMetrics.rmse.toFixed(4)} V`,
                  fm: `${result.fmMetrics.rmse.toFixed(4)} V`,
                  delta: `${result.fmMetrics.rmse - result.amMetrics.rmse >= 0 ? '+' : ''}${(result.fmMetrics.rmse - result.amMetrics.rmse).toFixed(4)} V`,
                },
                {
                  name: 'Waveform Correlation (ρ)',
                  am: result.amMetrics.correlation.toFixed(4),
                  fm: result.fmMetrics.correlation.toFixed(4),
                  delta: `${result.fmMetrics.correlation - result.amMetrics.correlation >= 0 ? '+' : ''}${(result.fmMetrics.correlation - result.amMetrics.correlation).toFixed(4)}`,
                },
                {
                  name: 'Theoretical RF Bandwidth',
                  am: `${result.amBandwidthKhz.toFixed(1)} kHz`,
                  fm: `${result.fmCarsonBandwidthKhz.toFixed(1)} kHz`,
                  delta: `${bwRatio.toFixed(2)}× wider`,
                },
                {
                  name: 'Active IF Filter ENBW',
                  am: `${result.amMetrics.ifBandwidthUsedKhz.toFixed(1)} kHz`,
                  fm: `${result.fmMetrics.ifBandwidthUsedKhz.toFixed(1)} kHz`,
                  delta: `${(result.fmMetrics.ifBandwidthUsedKhz / Math.max(0.1, result.amMetrics.ifBandwidthUsedKhz)).toFixed(2)}×`,
                },
              ].map((row) => (
                <tr
                  key={row.name}
                  className={
                    row.highlight
                      ? 'bg-slate-50/90 dark:bg-slate-800/40 font-semibold'
                      : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/20'
                  }
                >
                  <td className="py-2.5 px-4 font-sans text-slate-800 dark:text-slate-200">
                    {row.name}
                  </td>
                  <td className="py-2.5 px-4 text-right text-amber-600 dark:text-amber-400">
                    {row.am}
                  </td>
                  <td className="py-2.5 px-4 text-right text-emerald-600 dark:text-emerald-400">
                    {row.fm}
                  </td>
                  <td className="py-2.5 px-4 text-right text-slate-700 dark:text-slate-300">
                    {row.delta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bandwidth Comparison Visual */}
      <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1420] rounded-md p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            RF Transmission Bandwidth Comparison
          </h2>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            FM / AM Ratio: {bwRatio.toFixed(2)}×
          </span>
        </div>

        <div className="space-y-3 text-xs">
          {[
            {
              label: `AM Theoretical (2·fm)`,
              val: result.amBandwidthKhz,
              barClass: 'bg-amber-500',
            },
            {
              label: `AM Measured 99% Power BW`,
              val: result.amMeasuredBandwidth99Khz,
              barClass: 'bg-amber-500/60',
            },
            {
              label: `FM Carson's Rule 2(Δf + fm)`,
              val: result.fmCarsonBandwidthKhz,
              barClass: 'bg-emerald-500',
            },
            {
              label: `FM Measured 98% Power BW`,
              val: result.fmMeasuredBandwidth98Khz,
              barClass: 'bg-emerald-500/60',
            },
          ].map((item) => (
            <div key={item.label} className="space-y-1">
              <div className="flex items-center justify-between font-mono tabular-nums text-[11px]">
                <span className="font-sans text-slate-700 dark:text-slate-300">{item.label}</span>
                <span className="text-slate-900 dark:text-slate-100 font-medium">
                  {item.val.toFixed(1)} kHz
                </span>
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-sm overflow-hidden">
                <div
                  className={`h-full ${item.barClass}`}
                  style={{ width: `${Math.min(100, (item.val / maxBw) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Parameter Sensitivity Sweeps */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <OscilloscopePlot
          title="Effect of AM Modulation Index (μ) on Output SNR"
          subtitle={`Current channel σ = ${result.params.noiseSigma.toFixed(3)} V · Notice collapse past μ = 1.0`}
          series={[
            {
              label: 'AM Output SNR (dB)',
              x: amMuSweep.map((p) => p.paramValue),
              y: amMuSweep.map((p) => p.outputSnrDb),
              colorDark: '#F59E0B',
              colorLight: '#D97706',
              lineWidth: 2.1,
              showPoints: true,
            },
          ]}
          xLabel="AM Modulation Index (μ)"
          yLabel="AM Output SNR (dB)"
          xUnit=""
          yUnit="dB"
          markers={[
            {
              x: 1.0,
              label: 'Overmod Limit (μ=1)',
              colorDark: '#FB7185',
              colorLight: '#E11D48',
            },
            {
              x: result.effectiveMu,
              label: `Active μ=${result.effectiveMu.toFixed(2)}`,
              colorDark: '#22D3EE',
              colorLight: '#0284C7',
            },
          ]}
          height={265}
          isDark={isDark}
          exportFilename="comparison_am_mu_sensitivity"
        />

        <OscilloscopePlot
          title="Effect of FM Frequency Deviation (Δf) on Output SNR"
          subtitle={`Current channel σ = ${result.params.noiseSigma.toFixed(3)} V · Auto Carson IF filter`}
          series={[
            {
              label: 'FM Output SNR (dB)',
              x: fmDevSweep.map((p) => p.paramValue),
              y: fmDevSweep.map((p) => p.outputSnrDb),
              colorDark: '#34D399',
              colorLight: '#059669',
              lineWidth: 2.1,
              showPoints: true,
            },
          ]}
          xLabel="FM Frequency Deviation Δf (kHz)"
          yLabel="FM Output SNR (dB)"
          xUnit="kHz"
          yUnit="dB"
          markers={[
            {
              x: result.params.fmFreqDeviationKhz,
              label: `Active Δf=${result.params.fmFreqDeviationKhz.toFixed(0)} kHz`,
              colorDark: '#22D3EE',
              colorLight: '#0284C7',
            },
          ]}
          height={265}
          isDark={isDark}
          exportFilename="comparison_fm_deviation_sensitivity"
        />
      </div>
    </div>
  );
};
