import React, { useState } from 'react';
import { Square, Volume2 } from 'lucide-react';
import { labAudioPlayer } from '../dsp/audio';
import { SimulationResult } from '../dsp/types';

interface AudioConsoleProps {
  result: SimulationResult;
  compact?: boolean;
}

type ChannelId = 'original' | 'am' | 'fm';

export const AudioConsole: React.FC<AudioConsoleProps> = ({ result, compact = false }) => {
  const [playingChannel, setPlayingChannel] = useState<ChannelId | null>(null);
  const [pitchScale, setPitchScale] = useState<number>(0.25);

  const handlePlay = (channel: ChannelId) => {
    if (playingChannel === channel) {
      labAudioPlayer.stop();
      setPlayingChannel(null);
      return;
    }

    const buffer =
      channel === 'original'
        ? result.message
        : channel === 'am'
          ? result.amRecovered
          : result.fmRecovered;

    setPlayingChannel(channel);
    labAudioPlayer.playSignal(buffer, result.params.samplingFreqKhz, {
      pitchScale,
      playDurationSec: 1.8,
      volume: 0.24,
      onEnded: () => setPlayingChannel(null),
    });
  };

  const audibleFreqKhz = (result.params.messageFreqKhz * pitchScale).toFixed(2);

  return (
    <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1420] rounded-md p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
          <div>
            <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Audible Signal Playback
            </h4>
            {!compact && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Listen to resampled baseband waveforms ({audibleFreqKhz} kHz audible pitch)
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded p-0.5 bg-slate-50 dark:bg-[#0B0F17] text-[11px]">
            <button
              type="button"
              onClick={() => setPitchScale(0.25)}
              className={`px-2 py-1 rounded-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                pitchScale === 0.25
                  ? 'bg-cyan-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              0.25× ({(result.params.messageFreqKhz * 0.25).toFixed(1)} kHz)
            </button>
            <button
              type="button"
              onClick={() => setPitchScale(1.0)}
              className={`px-2 py-1 rounded-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                pitchScale === 1.0
                  ? 'bg-cyan-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              1× True ({result.params.messageFreqKhz.toFixed(1)} kHz)
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {(
              [
                { id: 'original', label: 'Original Message', accent: 'text-cyan-700 dark:text-cyan-400' },
                { id: 'am', label: 'AM Recovered', accent: 'text-amber-700 dark:text-amber-400' },
                { id: 'fm', label: 'FM Recovered', accent: 'text-emerald-700 dark:text-emerald-400' },
              ] as const
            ).map((btn) => {
              const active = playingChannel === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => handlePlay(btn.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-cyan-600 border-cyan-600 text-white'
                      : 'bg-slate-50 dark:bg-[#0B0F17] border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  {active ? (
                    <Square className="w-3 h-3 fill-current" />
                  ) : (
                    <Volume2 className={`w-3.5 h-3.5 ${btn.accent}`} />
                  )}
                  <span>{btn.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
