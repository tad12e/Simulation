import React, { useEffect, useState } from 'react';
import { FileSpreadsheet, Play, Shuffle } from 'lucide-react';
import { downloadCsv } from '../dsp/exportUtils';
import { runThresholdSweep } from '../dsp/simulator';
import {
  SimulationResult,
  ThresholdSweepConfig,
  ThresholdSweepResult,
} from '../dsp/types';
import { OscilloscopePlot, ShadedRegion, VerticalMarker } from './OscilloscopePlot';

interface ThresholdTabProps {
  result: SimulationResult;
  isDark: boolean;
}

export const ThresholdTab: React.FC<ThresholdTabProps> = ({ result, isDark }) => {
  const [config, setConfig] = useState<ThresholdSweepConfig>({
    cnrMaxDb: 28,
    cnrMinDb: -2,
    stepDb: 2,
    trialsPerPoint: 5,
    baseSeed: result.params.seed,
  });

  const [sweep, setSweep] = useState<ThresholdSweepResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const executeSweep = (cfg: ThresholdSweepConfig) => {
    setIsRunning(true);
    // Yield briefly so UI shows running state before synchronous Float64Array sweep
    window.setTimeout(() => {
      const output = runThresholdSweep(result.params, cfg);
      setSweep(output);
      setIsRunning(false);
    }, 16);
  };

  // Auto-run initial sweep on mount so the user sees live experimental data right away
  useEffect(() => {
    executeSweep(config);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExportSweepCsv = () => {
    if (!sweep) return;
    downloadCsv(
      'fm_threshold_cnr_sweep',
      [
        'FM IF Input CNR (dB)',
        'AM IF Input CNR (dB)',
        'FM Output SNR Mean (dB)',
        'FM Output SNR Std (dB)',
        'AM Output SNR Mean (dB)',
        'AM Output SNR Std (dB)',
        'FM NMSE (%)',
        'AM NMSE (%)',
        'FM RMSE (V)',
        'AM RMSE (V)',
        'Operating Region',
      ],
      sweep.points.map((p) => [
        p.inputCnrDb.toFixed(2),
        p.amIfCnrDb.toFixed(2),
        p.fmOutputSnrDb.toFixed(2),
        p.fmOutputSnrStdDb.toFixed(2),
        p.amOutputSnrDb.toFixed(2),
        p.amOutputSnrStdDb.toFixed(2),
        p.fmNmsePercent.toFixed(3),
        p.amNmsePercent.toFixed(3),
        p.fmRmse.toFixed(4),
        p.amRmse.toFixed(4),
        p.regime,
      ])
    );
  };

  const cnrX = sweep ? sweep.points.map((p) => p.inputCnrDb) : [];
  const fmSnrY = sweep ? sweep.points.map((p) => p.fmOutputSnrDb) : [];
  const amSnrY = sweep ? sweep.points.map((p) => p.amOutputSnrDb) : [];
  const fmNmseY = sweep ? sweep.points.map((p) => p.fmNmsePercent) : [];
  const amNmseY = sweep ? sweep.points.map((p) => p.amNmsePercent) : [];

  const shadedRegions: ShadedRegion[] = [];
  const markers: VerticalMarker[] = [];

  if (
    sweep &&
    sweep.points.length > 1 &&
    sweep.thresholdBandLowDb !== null &&
    sweep.thresholdBandHighDb !== null &&
    sweep.detectedThresholdCnrDb !== null
  ) {
    const minX = sweep.points[0].inputCnrDb;
    const maxX = sweep.points[sweep.points.length - 1].inputCnrDb;

    shadedRegions.push(
      {
        xStart: minX,
        xEnd: sweep.thresholdBandLowDb,
        label: 'Below Threshold',
        fillDark: 'rgba(244, 63, 94, 0.10)',
        fillLight: 'rgba(225, 29, 72, 0.08)',
        textDark: '#FB7185',
        textLight: '#BE123C',
      },
      {
        xStart: sweep.thresholdBandLowDb,
        xEnd: sweep.thresholdBandHighDb + 1.0,
        label: 'Threshold Knee',
        fillDark: 'rgba(245, 158, 11, 0.12)',
        fillLight: 'rgba(217, 119, 6, 0.10)',
        textDark: '#FBBF24',
        textLight: '#B45309',
      },
      {
        xStart: sweep.thresholdBandHighDb + 1.0,
        xEnd: maxX,
        label: 'Above Threshold (Linear FM Gain)',
        fillDark: 'rgba(52, 211, 153, 0.06)',
        fillLight: 'rgba(5, 150, 105, 0.06)',
        textDark: '#34D399',
        textLight: '#047857',
      }
    );

    markers.push({
      x: sweep.detectedThresholdCnrDb,
      label: `Knee ≈ ${sweep.detectedThresholdCnrDb.toFixed(1)} dB`,
      colorDark: '#FBBF24',
      colorLight: '#B45309',
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
            Noise &amp; FM Threshold Investigation
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
            Experimentally sweeps received Carrier-to-Noise Ratio (CNR) across the actual implemented AM envelope and FM quadrature receivers to locate the FM threshold collapse region.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
          <span>β = {result.fmBeta.toFixed(2)}</span>
          <span aria-hidden="true">·</span>
          <span>FM IF BW: {result.fmMetrics.ifBandwidthUsedKhz.toFixed(1)} kHz</span>
          <span aria-hidden="true">·</span>
          <span>AM IF BW: {result.amMetrics.ifBandwidthUsedKhz.toFixed(1)} kHz</span>
        </div>
      </div>

      {/* Sweep Configuration Controls */}
      <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1420] rounded-md p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
              Max CNR (dB)
            </label>
            <input
              type="number"
              value={config.cnrMaxDb}
              min={10}
              max={40}
              step={2}
              onChange={(e) =>
                setConfig((c) => ({ ...c, cnrMaxDb: Number(e.target.value) || 28 }))
              }
              className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#07090E] text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
              Min CNR (dB)
            </label>
            <input
              type="number"
              value={config.cnrMinDb}
              min={-6}
              max={10}
              step={1}
              onChange={(e) =>
                setConfig((c) => ({ ...c, cnrMinDb: Number(e.target.value) }))
              }
              className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#07090E] text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
              Step Size (dB)
            </label>
            <select
              value={config.stepDb}
              onChange={(e) =>
                setConfig((c) => ({ ...c, stepDb: Number(e.target.value) }))
              }
              className="w-full px-2.5 py-1.5 text-xs font-mono rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#07090E] text-slate-900 dark:text-slate-100"
            >
              <option value={1}>1.0 dB</option>
              <option value={2}>2.0 dB</option>
              <option value={3}>3.0 dB</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
              Trials / CNR Point
            </label>
            <input
              type="number"
              value={config.trialsPerPoint}
              min={1}
              max={20}
              step={1}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  trialsPerPoint: Math.max(1, Math.min(20, Math.round(Number(e.target.value) || 1))),
                }))
              }
              className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#07090E] text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
              Base PRNG Seed
            </label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={config.baseSeed}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    baseSeed: Math.max(1, Math.floor(Number(e.target.value) || 1)),
                  }))
                }
                className="w-full px-2 py-1.5 text-xs font-mono tabular-nums rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#07090E] text-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() =>
                  setConfig((c) => ({
                    ...c,
                    baseSeed: Math.floor(Math.random() * 90000) + 1000,
                  }))
                }
                title="Randomize sweep seed"
                className="p-1.5 rounded border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
              >
                <Shuffle className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <button
            type="button"
            disabled={isRunning}
            onClick={() => executeSweep(config)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white transition-colors whitespace-nowrap h-[30px] cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isRunning ? 'Running Sweep...' : 'Run CNR Sweep'}</span>
          </button>
        </div>
      </div>

      {/* Experimental Threshold Summary Strip */}
      {sweep && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1420] rounded-md p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Experimental FM Threshold Knee
            </div>
            <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">
              {sweep.detectedThresholdCnrDb !== null
                ? `${sweep.detectedThresholdCnrDb.toFixed(1)} dB`
                : 'Not Reached'}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {sweep.thresholdBandLowDb !== null && sweep.thresholdBandHighDb !== null
                ? `Transition band: ${sweep.thresholdBandLowDb.toFixed(1)} to ${(sweep.thresholdBandHighDb + 1).toFixed(1)} dB IF CNR`
                : 'Extend Min CNR lower to observe threshold breakdown'}
            </div>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1420] rounded-md p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Peak FM Collapse Slope
            </div>
            <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-rose-600 dark:text-rose-400">
              {sweep.maxSlopeDbPerDb.toFixed(2)}{' '}
              <span className="text-xs font-normal text-slate-500">dB / dB</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Linear above-threshold slope is ~1.0 dB/dB; steeper values mark click-noise breakdown
            </div>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1420] rounded-md p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Monte Carlo Averaging
            </div>
            <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {sweep.config.trialsPerPoint} × {sweep.points.length}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {sweep.config.trialsPerPoint * sweep.points.length} total real DSP demodulations · Seed {sweep.config.baseSeed}
            </div>
          </div>
        </div>
      )}

      {/* Primary FM Threshold Graphs */}
      {sweep && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <OscilloscopePlot
            title="Output SNR vs Received Input CNR (FM & AM)"
            subtitle="Measured across identical AWGN spectral density N0/2"
            series={[
              {
                label: 'FM Output SNR (dB)',
                x: cnrX,
                y: fmSnrY,
                colorDark: '#34D399',
                colorLight: '#059669',
                lineWidth: 2.2,
                showPoints: true,
              },
              {
                label: 'AM Output SNR (dB)',
                x: cnrX,
                y: amSnrY,
                colorDark: '#F59E0B',
                colorLight: '#D97706',
                lineWidth: 2.0,
                dashed: true,
                showPoints: true,
              },
            ]}
            xLabel="Received FM IF Input CNR (dB)"
            yLabel="Recovered Output SNR (dB)"
            xUnit="dB"
            yUnit="dB"
            markers={markers}
            shadedRegions={shadedRegions}
            height={295}
            isDark={isDark}
            exportFilename="fm_threshold_snr_vs_cnr"
          />

          <OscilloscopePlot
            title="Demodulated Distortion (NMSE %) vs Received CNR"
            subtitle="Sharp FM distortion surge marks threshold entry"
            series={[
              {
                label: 'FM NMSE (%)',
                x: cnrX,
                y: fmNmseY,
                colorDark: '#FB7185',
                colorLight: '#E11D48',
                lineWidth: 2.2,
                showPoints: true,
              },
              {
                label: 'AM NMSE (%)',
                x: cnrX,
                y: amNmseY,
                colorDark: '#F59E0B',
                colorLight: '#D97706',
                lineWidth: 1.9,
                dashed: true,
                showPoints: true,
              },
            ]}
            xLabel="Received FM IF Input CNR (dB)"
            yLabel="Normalized MSE (%)"
            xUnit="dB"
            yUnit="%"
            markers={markers}
            shadedRegions={shadedRegions}
            height={295}
            isDark={isDark}
            exportFilename="fm_threshold_nmse_vs_cnr"
          />
        </div>
      )}

      {/* Three-Regime Threshold Physics Explanation */}
      <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1420] rounded-md p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Physical Interpretation of the FM Threshold Effect
          </h2>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Experimentally determined — depends on β, IF bandwidth, noise PSD, and discriminator design
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          <div className="border-t border-slate-200 dark:border-slate-800 pt-2.5">
            <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              Above Threshold
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
              The carrier phasor dominates the noise vector inside the IF passband. Instantaneous phase perturbations remain small, yielding linear output SNR improvement (1 dB/dB) plus wideband FM processing gain proportional to β²(β + 1).
            </p>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-2.5">
            <div className="text-xs font-semibold text-amber-700 dark:text-amber-400">
              Near Threshold
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
              Noise peaks occasionally approach the carrier amplitude. The resultant I/Q phasor begins encircling the origin, injecting occasional ±2π phase jumps (Rice clicks) that manifest as audible pops and bend the output SNR curve downward from its linear asymptote.
            </p>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-2.5">
            <div className="text-xs font-semibold text-rose-700 dark:text-rose-400">
              Below Threshold
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
              Frequent phase-click impulses dominate the baseband discriminator output, causing FM output SNR to collapse steeply and NMSE distortion to skyrocket—often falling below conventional AM, which degrades more gradually without a sharp threshold cliff.
            </p>
          </div>
        </div>
      </div>

      {/* Measured Sweep Data Table */}
      {sweep && (
        <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1420] rounded-md overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Experimental Sweep Measurements ({sweep.points.length} CNR points)
            </h3>
            <button
              type="button"
              onClick={handleExportSweepCsv}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Sweep CSV</span>
            </button>
          </div>

          <div className="overflow-x-auto max-h-72 overflow-y-auto lab-scroll">
            <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
              <thead className="sticky top-0 bg-slate-50 dark:bg-[#0B0F17] border-b border-slate-200 dark:border-slate-800 font-sans text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="py-2 px-4 font-semibold">FM IF CNR</th>
                  <th className="py-2 px-3 font-semibold text-right">AM IF CNR</th>
                  <th className="py-2 px-3 font-semibold text-right">FM Out SNR</th>
                  <th className="py-2 px-3 font-semibold text-right">AM Out SNR</th>
                  <th className="py-2 px-3 font-semibold text-right">FM NMSE</th>
                  <th className="py-2 px-3 font-semibold text-right">AM NMSE</th>
                  <th className="py-2 px-4 font-semibold text-right">Regime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {[...sweep.points].reverse().map((p, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/30"
                  >
                    <td className="py-2 px-4 text-slate-900 dark:text-slate-100">
                      {p.inputCnrDb.toFixed(2)} dB
                    </td>
                    <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-400">
                      {p.amIfCnrDb.toFixed(2)} dB
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                      {p.fmOutputSnrDb.toFixed(2)} dB
                      {sweep.config.trialsPerPoint > 1 && (
                        <span className="text-[10px] font-normal text-slate-500 ml-1">
                          ±{p.fmOutputSnrStdDb.toFixed(1)}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-amber-600 dark:text-amber-400">
                      {p.amOutputSnrDb.toFixed(2)} dB
                    </td>
                    <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                      {p.fmNmsePercent.toFixed(2)}%
                    </td>
                    <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                      {p.amNmsePercent.toFixed(2)}%
                    </td>
                    <td
                      className={`py-2 px-4 text-right font-sans font-medium ${
                        p.regime === 'above'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : p.regime === 'near'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {p.regime === 'above'
                        ? 'Above'
                        : p.regime === 'near'
                          ? 'Near Knee'
                          : 'Below'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
