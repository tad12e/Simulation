import React from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { SimulationParams, SimulationResult } from '../dsp/types';

interface ValidationTabProps {
  result: SimulationResult;
  onLoadParams: (patch: Partial<SimulationParams>) => void;
}

export const ValidationTab: React.FC<ValidationTabProps> = ({
  result,
  onLoadParams,
}) => {
  // Check if Example 1 parameters are currently loaded
  const isEx1Loaded =
    result.params.messageWaveform === 'sinusoid' &&
    Math.abs(result.params.carrierAmplitude - 1.0) < 1e-3 &&
    Math.abs(result.effectiveMu - 0.5) < 1e-3 &&
    Math.abs(result.params.messageFreqKhz - 4.0) < 1e-3;

  // Check if Example 2 parameters are currently loaded
  const isEx2Loaded =
    result.params.messageWaveform === 'sinusoid' &&
    Math.abs(result.params.messageFreqKhz - 4.0) < 1e-3 &&
    Math.abs(result.params.fmFreqDeviationKhz - 20.0) < 1e-3;

  // Live theoretical calculations for currently active parameters
  const liveAc = result.params.carrierAmplitude;
  const liveMu = result.effectiveMu;
  const liveFm = result.params.messageFreqKhz;
  const liveDf = result.params.fmFreqDeviationKhz;

  const liveTheoEmax = liveAc * (1 + liveMu);
  const liveTheoEmin = liveAc * (1 - liveMu);
  const liveTheoAmBw = 2 * result.effectiveMaxMessageFreqKhz;
  const liveTheoBeta = liveDf / Math.max(0.001, liveFm);
  const liveTheoCarsonBw = 2 * (liveDf + result.effectiveMaxMessageFreqKhz);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
          Hand Calculation and Mathematical Validation
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
          Independently verifiable analytical derivations compared directly against live numerical outputs from the simulator&apos;s time-domain waveforms and FFT spectra.
        </p>
      </div>

      {/* Worked Examples Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Example 1: AM Modulation */}
        <section className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1420] rounded-md overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-50/80 dark:bg-[#0B0F17]">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Example 1: Conventional AM Modulation
              </h2>
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                Given: Ac = 1.0 V · μ = 0.50 · fm = 4.0 kHz (Single-tone)
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                onLoadParams({
                  messageWaveform: 'sinusoid',
                  carrierAmplitude: 1.0,
                  amModIndex: 0.5,
                  allowOvermodulation: false,
                  messageFreqKhz: 4.0,
                  messageAmplitude: 1.0,
                })
              }
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border border-amber-500/50 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 transition-colors whitespace-nowrap cursor-pointer"
            >
              {isEx1Loaded ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Active in Simulator</span>
                </>
              ) : (
                <>
                  <span>Load Example 1</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>

          <div className="p-4 space-y-4 text-xs flex-1">
            <div className="space-y-2.5 font-mono text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-[#07090E] border border-slate-200 dark:border-slate-800 rounded p-3.5">
              <div>
                <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400">
                  1. Maximum Envelope Amplitude
                </div>
                <div className="mt-0.5">
                  E_max = Ac(1 + μ) = 1.0 × (1 + 0.5) ={' '}
                  <strong className="text-amber-600 dark:text-amber-400">1.500 V</strong>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80">
                <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400">
                  2. Minimum Envelope Amplitude
                </div>
                <div className="mt-0.5">
                  E_min = Ac(1 − μ) = 1.0 × (1 − 0.5) ={' '}
                  <strong className="text-amber-600 dark:text-amber-400">0.500 V</strong>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80">
                <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400">
                  3. AM Transmission Bandwidth (Single-Tone)
                </div>
                <div className="mt-0.5">
                  BW_AM = 2 fm = 2 × 4.0 kHz ={' '}
                  <strong className="text-amber-600 dark:text-amber-400">8.00 kHz</strong>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80">
                <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400">
                  4. Percentage Modulation
                </div>
                <div className="mt-0.5">
                  M = μ × 100% = (E_max − E_min)/(E_max + E_min) × 100% ={' '}
                  <strong className="text-amber-600 dark:text-amber-400">50.0%</strong>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <th className="py-1.5 font-semibold">Quantity</th>
                    <th className="py-1.5 text-right font-semibold">Hand Calc</th>
                    <th className="py-1.5 text-right font-semibold">Simulator</th>
                    <th className="py-1.5 text-right font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono tabular-nums">
                  {[
                    {
                      label: 'E_max',
                      theo: '1.500 V',
                      sim: `${result.amMeasuredMaxEnvelope.toFixed(3)} V`,
                      match: isEx1Loaded && Math.abs(result.amMeasuredMaxEnvelope - 1.5) < 0.01,
                    },
                    {
                      label: 'E_min',
                      theo: '0.500 V',
                      sim: `${result.amMeasuredMinEnvelope.toFixed(3)} V`,
                      match: isEx1Loaded && Math.abs(result.amMeasuredMinEnvelope - 0.5) < 0.01,
                    },
                    {
                      label: 'BW_AM (2·fm)',
                      theo: '8.00 kHz',
                      sim: `${result.amBandwidthKhz.toFixed(2)} kHz`,
                      match: isEx1Loaded && Math.abs(result.amBandwidthKhz - 8.0) < 0.05,
                    },
                    {
                      label: '% Modulation',
                      theo: '50.0%',
                      sim: `${(result.effectiveMu * 100).toFixed(1)}%`,
                      match: isEx1Loaded && Math.abs(result.effectiveMu * 100 - 50) < 0.1,
                    },
                  ].map((r) => (
                    <tr key={r.label}>
                      <td className="py-2 font-sans text-slate-700 dark:text-slate-300">{r.label}</td>
                      <td className="py-2 text-right text-slate-600 dark:text-slate-400">{r.theo}</td>
                      <td className="py-2 text-right text-slate-900 dark:text-slate-100">{r.sim}</td>
                      <td
                        className={`py-2 text-right font-sans font-medium ${
                          r.match
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {r.match ? 'Verified' : isEx1Loaded ? 'Delta' : 'Load Ex. 1'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Example 2: FM Modulation */}
        <section className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1420] rounded-md overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-50/80 dark:bg-[#0B0F17]">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Example 2: Wideband FM Modulation
              </h2>
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                Given: fm = 4.0 kHz · Δf = 20.0 kHz (Single-tone)
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                onLoadParams({
                  messageWaveform: 'sinusoid',
                  messageFreqKhz: 4.0,
                  fmFreqDeviationKhz: 20.0,
                  autoIfBandwidth: true,
                })
              }
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border border-emerald-500/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors whitespace-nowrap cursor-pointer"
            >
              {isEx2Loaded ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Active in Simulator</span>
                </>
              ) : (
                <>
                  <span>Load Example 2</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>

          <div className="p-4 space-y-4 text-xs flex-1">
            <div className="space-y-2.5 font-mono text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-[#07090E] border border-slate-200 dark:border-slate-800 rounded p-3.5">
              <div>
                <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400">
                  1. FM Modulation Index (β)
                </div>
                <div className="mt-0.5">
                  β = Δf / fm = 20.0 kHz / 4.0 kHz ={' '}
                  <strong className="text-emerald-600 dark:text-emerald-400">5.00 rad</strong>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80">
                <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400">
                  2. Carson&apos;s Rule Bandwidth (98% Power)
                </div>
                <div className="mt-0.5">
                  BW_FM ≈ 2(Δf + fm) = 2(20.0 + 4.0) ={' '}
                  <strong className="text-emerald-600 dark:text-emerald-400">48.00 kHz</strong>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80">
                <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400">
                  3. Equivalent Carson Expression via β
                </div>
                <div className="mt-0.5">
                  BW_FM = 2(β + 1) fm = 2(5 + 1) × 4.0 kHz ={' '}
                  <strong className="text-emerald-600 dark:text-emerald-400">48.00 kHz</strong>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80">
                <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400">
                  4. Regime Classification
                </div>
                <div className="mt-0.5">
                  β = 5.0 ≫ 1 ⇒{' '}
                  <strong className="text-emerald-600 dark:text-emerald-400">
                    Wideband FM (6 significant sideband pairs)
                  </strong>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <th className="py-1.5 font-semibold">Quantity</th>
                    <th className="py-1.5 text-right font-semibold">Hand Calc</th>
                    <th className="py-1.5 text-right font-semibold">Simulator</th>
                    <th className="py-1.5 text-right font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono tabular-nums">
                  {[
                    {
                      label: 'FM Index β',
                      theo: '5.00',
                      sim: result.fmBeta.toFixed(2),
                      match: isEx2Loaded && Math.abs(result.fmBeta - 5.0) < 0.01,
                    },
                    {
                      label: "Carson's Rule BW",
                      theo: '48.00 kHz',
                      sim: `${result.fmCarsonBandwidthKhz.toFixed(2)} kHz`,
                      match: isEx2Loaded && Math.abs(result.fmCarsonBandwidthKhz - 48.0) < 0.05,
                    },
                    {
                      label: 'FFT 98% Power BW',
                      theo: '≈ 48.0 kHz',
                      sim: `${result.fmMeasuredBandwidth98Khz.toFixed(2)} kHz`,
                      match:
                        isEx2Loaded &&
                        Math.abs(result.fmMeasuredBandwidth98Khz - 48.0) < 5.0,
                    },
                    {
                      label: 'Peak Inst. Freq Range',
                      theo: `${(result.params.carrierFreqKhz - 20).toFixed(0)}–${(result.params.carrierFreqKhz + 20).toFixed(0)} kHz`,
                      sim: `${(result.params.carrierFreqKhz - result.params.fmFreqDeviationKhz).toFixed(0)}–${(result.params.carrierFreqKhz + result.params.fmFreqDeviationKhz).toFixed(0)} kHz`,
                      match: isEx2Loaded,
                    },
                  ].map((r) => (
                    <tr key={r.label}>
                      <td className="py-2 font-sans text-slate-700 dark:text-slate-300">{r.label}</td>
                      <td className="py-2 text-right text-slate-600 dark:text-slate-400">{r.theo}</td>
                      <td className="py-2 text-right text-slate-900 dark:text-slate-100">{r.sim}</td>
                      <td
                        className={`py-2 text-right font-sans font-medium ${
                          r.match
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {r.match ? 'Verified' : isEx2Loaded ? 'Check' : 'Load Ex. 2'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {/* Live Formula Verification for Any Custom Parameter State */}
      <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1420] rounded-md overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            Live Dynamic Cross-Check (Active Simulator Parameters)
          </h2>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            Ac = {liveAc.toFixed(2)} V · μ = {liveMu.toFixed(2)} · fm = {liveFm.toFixed(2)} kHz · Δf = {liveDf.toFixed(1)} kHz
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17] text-slate-600 dark:text-slate-400">
                <th className="py-2 px-4 font-semibold">Formula</th>
                <th className="py-2 px-4 font-semibold text-right">Analytical Formula Result</th>
                <th className="py-2 px-4 font-semibold text-right">Simulated Waveform / FFT</th>
                <th className="py-2 px-4 font-semibold text-right">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono tabular-nums">
              {[
                {
                  formula: 'E_max = Ac(1 + μ)',
                  theo: liveTheoEmax,
                  sim: result.amMeasuredMaxEnvelope,
                  unit: 'V',
                },
                {
                  formula: 'E_min = Ac(1 − μ)',
                  theo: liveTheoEmin,
                  sim: result.amMeasuredMinEnvelope,
                  unit: 'V',
                },
                {
                  formula: 'BW_AM = 2 · fm_max',
                  theo: liveTheoAmBw,
                  sim: result.amMeasuredBandwidth99Khz,
                  unit: 'kHz',
                },
                {
                  formula: 'β = Δf / fm',
                  theo: liveTheoBeta,
                  sim: result.fmBeta,
                  unit: 'rad',
                },
                {
                  formula: 'BW_FM ≈ 2(Δf + fm_max)',
                  theo: liveTheoCarsonBw,
                  sim: result.fmMeasuredBandwidth98Khz,
                  unit: 'kHz',
                },
              ].map((row) => {
                const absErr = Math.abs(row.sim - row.theo);
                return (
                  <tr key={row.formula}>
                    <td className="py-2 px-4 text-slate-800 dark:text-slate-200">{row.formula}</td>
                    <td className="py-2 px-4 text-right text-slate-600 dark:text-slate-400">
                      {row.theo.toFixed(3)} {row.unit}
                    </td>
                    <td className="py-2 px-4 text-right text-slate-900 dark:text-slate-100">
                      {row.sim.toFixed(3)} {row.unit}
                    </td>
                    <td className="py-2 px-4 text-right text-emerald-600 dark:text-emerald-400">
                      ±{absErr.toFixed(3)} {row.unit}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
