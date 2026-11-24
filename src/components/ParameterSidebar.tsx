import React from 'react';
import { Play, RotateCcw, Shuffle } from 'lucide-react';
import {
  computeAutoBandwidths,
  EXPERIMENT_PRESETS,
  WAVEFORM_META,
} from '../dsp/signals';
import { computeSigmaForTargetCnr } from '../dsp/simulator';
import {
  ExperimentPresetId,
  MessageWaveform,
  RectifierMode,
  SimulationParams,
  SimulationResult,
} from '../dsp/types';

interface ParameterSidebarProps {
  params: SimulationParams;
  activePreset: ExperimentPresetId;
  result: SimulationResult;
  onChangeParams: (patch: Partial<SimulationParams>, presetOverride?: ExperimentPresetId) => void;
  onSelectPreset: (presetId: Exclude<ExperimentPresetId, 'custom'>) => void;
  onRunSimulation: () => void;
  onReset: () => void;
}

interface SliderControlProps {
  label: string;
  unit?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  decimals?: number;
  disabled?: boolean;
  onChange: (val: number) => void;
}

const SliderControl: React.FC<SliderControlProps> = ({
  label,
  unit,
  value,
  min,
  max,
  step,
  decimals = 2,
  disabled = false,
  onChange,
}) => {
  return (
    <div className={disabled ? 'opacity-50 pointer-events-none' : ''}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <label className="text-xs text-slate-700 dark:text-slate-300 font-medium truncate">
          {label}
        </label>
        <div className="flex items-center gap-1 shrink-0">
          <input
            type="number"
            value={Number(value.toFixed(decimals))}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            onChange={(e) => {
              const parsed = parseFloat(e.target.value);
              if (Number.isFinite(parsed)) {
                onChange(Math.max(min, Math.min(max, parsed)));
              }
            }}
            className="w-16 px-1.5 py-0.5 text-right font-mono tabular-nums text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#07090E] text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
          />
          {unit && (
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 w-7">
              {unit}
            </span>
          )}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.max(min, Math.min(max, value))}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="lab-slider"
      />
    </div>
  );
};

export const ParameterSidebar: React.FC<ParameterSidebarProps> = ({
  params,
  activePreset,
  result,
  onChangeParams,
  onSelectPreset,
  onRunSimulation,
  onReset,
}) => {
  const autoBw = computeAutoBandwidths(params);
  const maxMu = params.allowOvermodulation ? 1.8 : 1.0;

  return (
    <aside className="w-full lg:w-[328px] xl:w-[344px] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F17] flex flex-col">
      {/* Experiment Presets */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            Predefined Experiments
          </h2>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            {activePreset === 'custom' ? 'Custom' : `Exp. ${activePreset === 'clean' ? '1' : activePreset === 'moderate' ? '2' : '3'}`}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {EXPERIMENT_PRESETS.map((preset) => {
            const isActive = activePreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectPreset(preset.id)}
                className={`px-2 py-2 text-[11px] font-medium rounded border text-center transition-colors whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-cyan-600 border-cyan-600 text-white'
                    : 'bg-slate-50 dark:bg-[#0F1420] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-cyan-500/60'
                }`}
              >
                {preset.shortLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable Parameter Sections */}
      <div className="flex-1 overflow-y-auto lab-scroll divide-y divide-slate-200 dark:divide-slate-800/80">
        {/* 1. Message Signal */}
        <section className="p-4 space-y-3">
          <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            01. Message Signal
          </h3>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Waveform Shape
            </label>
            <select
              value={params.messageWaveform}
              onChange={(e) =>
                onChangeParams({ messageWaveform: e.target.value as MessageWaveform })
              }
              className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F1420] text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
            >
              {(Object.keys(WAVEFORM_META) as MessageWaveform[]).map((wf) => (
                <option key={wf} value={wf}>
                  {WAVEFORM_META[wf].label}
                </option>
              ))}
            </select>
          </div>

          <SliderControl
            label="Message Frequency (fm)"
            unit="kHz"
            value={params.messageFreqKhz}
            min={1.0}
            max={8.0}
            step={0.25}
            decimals={2}
            onChange={(v) => onChangeParams({ messageFreqKhz: v })}
          />

          <SliderControl
            label="Message Amplitude (Am)"
            unit="V"
            value={params.messageAmplitude}
            min={0.2}
            max={2.5}
            step={0.1}
            decimals={2}
            onChange={(v) => onChangeParams({ messageAmplitude: v })}
          />
        </section>

        {/* 2. Carrier & Sampling */}
        <section className="p-4 space-y-3">
          <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            02. Carrier &amp; Sampling
          </h3>

          <SliderControl
            label="Carrier Frequency (fc)"
            unit="kHz"
            value={params.carrierFreqKhz}
            min={40}
            max={240}
            step={5}
            decimals={0}
            onChange={(v) => onChangeParams({ carrierFreqKhz: v })}
          />

          <SliderControl
            label="Carrier Amplitude (Ac)"
            unit="V"
            value={params.carrierAmplitude}
            min={0.2}
            max={2.5}
            step={0.1}
            decimals={2}
            onChange={(v) => onChangeParams({ carrierAmplitude: v })}
          />

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Sampling Rate (fs)
              </label>
              <select
                value={params.samplingFreqKhz}
                onChange={(e) =>
                  onChangeParams({ samplingFreqKhz: Number(e.target.value) })
                }
                className="w-full px-2 py-1.5 text-xs font-mono rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F1420] text-slate-900 dark:text-slate-100"
              >
                <option value={512}>512 kHz</option>
                <option value={1024}>1024 kHz</option>
                <option value={2048}>2048 kHz</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                FFT Samples (N)
              </label>
              <select
                value={params.numSamples}
                onChange={(e) =>
                  onChangeParams({ numSamples: Number(e.target.value) })
                }
                className="w-full px-2 py-1.5 text-xs font-mono rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F1420] text-slate-900 dark:text-slate-100"
              >
                <option value={4096}>4096</option>
                <option value={8192}>8192</option>
                <option value={16384}>16384</option>
              </select>
            </div>
          </div>
        </section>

        {/* 3. AM & FM Modulation */}
        <section className="p-4 space-y-3">
          <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            03. Modulation Parameters
          </h3>

          <SliderControl
            label="AM Mod. Index (μ)"
            value={params.allowOvermodulation ? params.amModIndex : Math.min(1, params.amModIndex)}
            min={0.1}
            max={maxMu}
            step={0.05}
            decimals={2}
            onChange={(v) => onChangeParams({ amModIndex: v })}
          />

          <label className="flex items-center justify-between gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <span>Allow AM overmodulation (μ &gt; 1.0)</span>
            <input
              type="checkbox"
              checked={params.allowOvermodulation}
              onChange={(e) => {
                const checked = e.target.checked;
                onChangeParams({
                  allowOvermodulation: checked,
                  amModIndex: checked ? params.amModIndex : Math.min(1.0, params.amModIndex),
                });
              }}
              className="accent-cyan-600 w-3.5 h-3.5 cursor-pointer"
            />
          </label>

          <div className="pt-1 border-t border-slate-100 dark:border-slate-800/70 space-y-2">
            <SliderControl
              label="FM Freq. Deviation (Δf)"
              unit="kHz"
              value={params.fmFreqDeviationKhz}
              min={2}
              max={45}
              step={1}
              decimals={1}
              onChange={(v) => onChangeParams({ fmFreqDeviationKhz: v })}
            />
            <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
              <span>FM Index β = Δf / fm</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                {result.fmBeta.toFixed(2)} rad
              </span>
            </div>
          </div>
        </section>

        {/* 4. AWGN Channel & Attenuation */}
        <section className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              04. Channel &amp; AWGN Noise
            </h3>
            <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
              FM CNR: {result.fmMetrics.ifCnrDb.toFixed(1)} dB
            </span>
          </div>

          <SliderControl
            label="AWGN Noise Level (σ)"
            unit="V"
            value={params.noiseSigma}
            min={0.005}
            max={1.2}
            step={0.01}
            decimals={3}
            onChange={(v) => onChangeParams({ noiseSigma: v }, 'custom')}
          />

          <SliderControl
            label="Received Amplitude (α)"
            value={params.channelAttenuation}
            min={0.1}
            max={1.0}
            step={0.02}
            decimals={2}
            onChange={(v) => onChangeParams({ channelAttenuation: v }, 'custom')}
          />

          <SliderControl
            label="Set by Target FM CNR"
            unit="dB"
            value={Math.max(-2, Math.min(40, Number(result.fmMetrics.ifCnrDb.toFixed(1))))}
            min={-2}
            max={40}
            step={0.5}
            decimals={1}
            onChange={(targetCnrDb) => {
              const sigma = computeSigmaForTargetCnr(params, targetCnrDb);
              onChangeParams({ noiseSigma: Number(sigma.toFixed(4)) }, 'custom');
            }}
          />

          <div className="flex items-center justify-between gap-2 pt-1">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              PRNG Noise Seed
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={params.seed}
                onChange={(e) =>
                  onChangeParams({ seed: Math.max(1, Math.floor(Number(e.target.value) || 1)) })
                }
                className="w-20 px-2 py-1 text-right font-mono tabular-nums text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#07090E] text-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() =>
                  onChangeParams({ seed: Math.floor(Math.random() * 90000) + 1000 })
                }
                title="Randomize noise realization"
                className="p-1.5 rounded border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Shuffle className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </section>

        {/* 5. Receiver Settings (IF BPF & LPF) */}
        <section className="p-4 space-y-3">
          <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            05. Receiver &amp; IF Filtering
          </h3>

          <label className="flex items-center justify-between gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <span>Pre-detection IF Bandpass Filter</span>
            <input
              type="checkbox"
              checked={params.ifFilterEnabled}
              onChange={(e) => onChangeParams({ ifFilterEnabled: e.target.checked })}
              className="accent-cyan-600 w-3.5 h-3.5 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <span>Auto-match Carson / DSB Bandwidths</span>
            <input
              type="checkbox"
              checked={params.autoIfBandwidth}
              onChange={(e) =>
                onChangeParams({
                  autoIfBandwidth: e.target.checked,
                  amIfBandwidthKhz: autoBw.amIfBandwidthKhz,
                  fmIfBandwidthKhz: autoBw.fmIfBandwidthKhz,
                  audioLpfCutoffKhz: autoBw.audioLpfKhz,
                })
              }
              className="accent-cyan-600 w-3.5 h-3.5 cursor-pointer"
            />
          </label>

          <SliderControl
            label="AM IF Bandwidth"
            unit="kHz"
            value={params.autoIfBandwidth ? autoBw.amIfBandwidthKhz : params.amIfBandwidthKhz}
            min={6}
            max={60}
            step={1}
            decimals={1}
            disabled={!params.ifFilterEnabled || params.autoIfBandwidth}
            onChange={(v) => onChangeParams({ amIfBandwidthKhz: v })}
          />

          <SliderControl
            label="FM IF Bandwidth"
            unit="kHz"
            value={params.autoIfBandwidth ? autoBw.fmIfBandwidthKhz : params.fmIfBandwidthKhz}
            min={12}
            max={120}
            step={2}
            decimals={1}
            disabled={!params.ifFilterEnabled || params.autoIfBandwidth}
            onChange={(v) => onChangeParams({ fmIfBandwidthKhz: v })}
          />

          <SliderControl
            label="Audio Post-LPF Cutoff"
            unit="kHz"
            value={params.autoIfBandwidth ? autoBw.audioLpfKhz : params.audioLpfCutoffKhz}
            min={3}
            max={20}
            step={0.5}
            decimals={1}
            disabled={params.autoIfBandwidth}
            onChange={(v) => onChangeParams({ audioLpfCutoffKhz: v })}
          />

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
              AM Envelope Rectifier
            </span>
            <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded p-0.5 bg-slate-50 dark:bg-[#0F1420] text-[11px]">
              {(['full_wave', 'half_wave'] as RectifierMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onChangeParams({ amRectifierMode: mode })}
                  className={`px-2 py-0.5 rounded-sm font-medium whitespace-nowrap cursor-pointer ${
                    params.amRectifierMode === mode
                      ? 'bg-cyan-600 text-white'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {mode === 'full_wave' ? 'Full-Wave' : 'Half-Wave'}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Bottom Action Bar */}
      <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0F1420] flex items-center gap-2">
        <button
          type="button"
          onClick={onRunSimulation}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded bg-cyan-600 hover:bg-cyan-500 text-white transition-colors whitespace-nowrap cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Run Simulation</span>
        </button>

        <button
          type="button"
          onClick={onReset}
          title="Reset all simulation parameters to defaults"
          className="inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      </div>
    </aside>
  );
};
