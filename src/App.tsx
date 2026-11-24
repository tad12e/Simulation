import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Moon,
  Play,
  SlidersHorizontal,
  Sun,
  XCircle,
} from 'lucide-react';
import { AmSimulationTab } from './components/AmSimulationTab';
import { ComparisonTab } from './components/ComparisonTab';
import { FmSimulationTab } from './components/FmSimulationTab';
import { OverviewTab } from './components/OverviewTab';
import { ParameterSidebar } from './components/ParameterSidebar';
import { ThresholdTab } from './components/ThresholdTab';
import { ValidationTab } from './components/ValidationTab';
import {
  DEFAULT_SIMULATION_PARAMS,
  EXPERIMENT_PRESETS,
} from './dsp/signals';
import { runSimulation } from './dsp/simulator';
import {
  ExperimentPresetId,
  SimulationParams,
  TabId,
} from './dsp/types';

const TABS: { id: TabId; label: string; fullTitle: string }[] = [
  { id: 'overview', label: 'Overview', fullTitle: '1. Overview' },
  { id: 'am', label: 'AM Simulation', fullTitle: '2. AM Simulation' },
  { id: 'fm', label: 'FM Simulation', fullTitle: '3. FM Simulation' },
  { id: 'threshold', label: 'FM Threshold', fullTitle: '4. Noise & FM Threshold Experiment' },
  { id: 'comparison', label: 'AM vs FM', fullTitle: '5. AM vs FM Comparison' },
  { id: 'validation', label: 'Validation', fullTitle: '6. Mathematical Validation' },
];

export default function App() {
  // Default to Dark Oscilloscope theme per user preference
  const [isDark, setIsDark] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [activePreset, setActivePreset] = useState<ExperimentPresetId>('clean');
  const [params, setParams] = useState<SimulationParams>(DEFAULT_SIMULATION_PARAMS);
  const [runCounter, setRunCounter] = useState(0);
  const [sidebarOpenMobile, setSidebarOpenMobile] = useState(false);

  // Sync Tailwind v4 .dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  // Execute actual numerical DSP simulation whenever parameters or Run trigger updates
  const result = useMemo(
    () => runSimulation(params),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params, runCounter]
  );

  const handleChangeParams = (
    patch: Partial<SimulationParams>,
    presetOverride?: ExperimentPresetId
  ) => {
    setParams((prev) => ({ ...prev, ...patch }));
    if (presetOverride) {
      setActivePreset(presetOverride);
    }
  };

  const handleSelectPreset = (presetId: Exclude<ExperimentPresetId, 'custom'>) => {
    const preset = EXPERIMENT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setParams((prev) => ({ ...prev, ...preset.patch }));
    setActivePreset(presetId);
  };

  const handleRunSimulation = () => {
    setRunCounter((c) => c + 1);
  };

  const handleReset = () => {
    setParams(DEFAULT_SIMULATION_PARAMS);
    setActivePreset('clean');
    setRunCounter((c) => c + 1);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#07090E] text-slate-900 dark:text-slate-100">
      {/* Clean 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0B0F17]/95 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-6 px-4 lg:px-6 h-13">
          {/* Zone 1: Single-element Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
          >
            RF CommLab
          </button>

          {/* Zone 2: Clean Single-Line Navigation Tabs */}
          <nav
            aria-label="Laboratory Sections"
            className="hidden md:flex items-center gap-5 overflow-x-auto"
          >
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-3.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'border-cyan-600 dark:border-cyan-400 text-cyan-700 dark:text-cyan-400'
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Primary Action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={handleRunSimulation}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded bg-cyan-600 hover:bg-cyan-500 text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Simulation</span>
            </button>
          </div>
        </div>

        {/* Mobile Tab Strip */}
        <div className="flex md:hidden items-center gap-1 px-3 py-1.5 overflow-x-auto border-t border-slate-200 dark:border-slate-800">
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Split Laboratory Bench */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Mobile Controls Drawer Toggle + Workspace Utility Bar */}
        <div className="lg:hidden flex items-center justify-between gap-2 px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1420]">
          <button
            type="button"
            onClick={() => setSidebarOpenMobile((v) => !v)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{sidebarOpenMobile ? 'Hide Parameters' : 'Simulation Parameters'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDark((d) => !d)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </div>

        {/* Left Parameter & Preset Control Column */}
        <div className={`${sidebarOpenMobile ? 'block' : 'hidden'} lg:block lg:sticky lg:top-13 lg:h-[calc(100vh-3.25rem)]`}>
          <div className="h-full flex">
            <ParameterSidebar
              params={params}
              activePreset={activePreset}
              result={result}
              onChangeParams={handleChangeParams}
              onSelectPreset={handleSelectPreset}
              onRunSimulation={handleRunSimulation}
              onReset={handleReset}
            />
          </div>
        </div>

        {/* Right Primary Analytical Viewport */}
        <main className="flex-1 min-w-0 flex flex-col">
          {/* Desktop Workspace Utility Bar (Theme toggle & live experiment context) */}
          <div className="hidden lg:flex items-center justify-between gap-4 px-6 py-2 border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0B0F17]/70 text-xs">
            <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400 font-mono tabular-nums">
              <span>fm = {params.messageFreqKhz.toFixed(2)} kHz</span>
              <span aria-hidden="true">·</span>
              <span>fc = {params.carrierFreqKhz.toFixed(0)} kHz</span>
              <span aria-hidden="true">·</span>
              <span>fs = {params.samplingFreqKhz.toFixed(0)} kHz</span>
              <span aria-hidden="true">·</span>
              <span>
                IF BPF: {params.ifFilterEnabled ? 'On' : 'Bypassed'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsDark((d) => !d)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-600" />}
              <span>{isDark ? 'Light Academic Theme' : 'Dark Oscilloscope Theme'}</span>
            </button>
          </div>

          <div className="p-4 sm:p-6 max-w-[1440px] w-full mx-auto space-y-5">
            {/* Parameter Validation Errors / Warnings */}
            {result.validation.errors.length > 0 && (
              <div className="border border-rose-500/40 bg-rose-50 dark:bg-rose-950/30 rounded-md p-3.5 text-xs text-rose-800 dark:text-rose-200 space-y-1">
                <div className="flex items-center gap-2 font-semibold">
                  <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>Invalid Parameter Combination Detected</span>
                </div>
                {result.validation.errors.map((err, i) => (
                  <p key={i} className="pl-6">
                    {err}
                  </p>
                ))}
              </div>
            )}

            {result.validation.warnings.length > 0 && (
              <div className="border border-amber-500/40 bg-amber-50 dark:bg-amber-950/25 rounded-md p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Engineering Advisory</span>
                </div>
                {result.validation.warnings.map((warn, i) => (
                  <p key={i} className="pl-6">
                    {warn}
                  </p>
                ))}
              </div>
            )}

            {/* Active Tab View */}
            {activeTab === 'overview' && (
              <OverviewTab
                result={result}
                activePreset={activePreset}
                isDark={isDark}
                onSelectPreset={handleSelectPreset}
              />
            )}

            {activeTab === 'am' && (
              <AmSimulationTab
                result={result}
                isDark={isDark}
                onChangeParams={(p) => handleChangeParams(p, 'custom')}
              />
            )}

            {activeTab === 'fm' && (
              <FmSimulationTab
                result={result}
                isDark={isDark}
                onChangeParams={(p) => handleChangeParams(p, 'custom')}
              />
            )}

            {activeTab === 'threshold' && (
              <ThresholdTab result={result} isDark={isDark} />
            )}

            {activeTab === 'comparison' && (
              <ComparisonTab result={result} isDark={isDark} />
            )}

            {activeTab === 'validation' && (
              <ValidationTab
                result={result}
                onLoadParams={(p) => handleChangeParams(p, 'custom')}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
