/**
 * Real-time Web Audio API synthesizer that resamples generated Float64Array
 * baseband waveforms so users can audibly compare Original, AM Recovered, and FM Recovered signals.
 */
class LabAudioPlayer {
  private ctx: AudioContext | null = null;
  private activeSource: AudioBufferSourceNode | null = null;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  stop(): void {
    if (this.activeSource) {
      try {
        this.activeSource.stop();
        this.activeSource.disconnect();
      } catch {
        // Already stopped
      }
      this.activeSource = null;
    }
  }

  /**
   * Play a simulated signal buffer looped smoothly for `playDurationSec` seconds.
   * `pitchScale`: 1.0 plays at true frequency (e.g. 4 kHz); 0.25 plays at comfortable 1 kHz.
   */
  playSignal(
    signal: Float64Array,
    samplingFreqKhz: number,
    options?: {
      pitchScale?: number;
      playDurationSec?: number;
      volume?: number;
      onEnded?: () => void;
    }
  ): void {
    this.stop();
    const ctx = this.ensureContext();
    const pitchScale = options?.pitchScale ?? 0.25;
    const playDurationSec = options?.playDurationSec ?? 1.6;
    const volume = options?.volume ?? 0.25;

    // Trim edge filter transients before looping
    const margin = Math.floor(signal.length * 0.08);
    const usableStart = margin;
    const usableLen = Math.max(64, signal.length - 2 * margin);

    // Normalize peak safely to prevent clipping
    let maxAbs = 0;
    for (let i = 0; i < usableLen; i++) {
      const v = Math.abs(signal[usableStart + i]);
      if (v > maxAbs) maxAbs = v;
    }
    const norm = maxAbs > 1e-9 ? 1 / maxAbs : 0;

    // Resample from fsHz * pitchScale into hardware sampleRate
    const outRate = ctx.sampleRate;
    const outSamples = Math.floor(outRate * playDurationSec);
    const buffer = ctx.createBuffer(1, outSamples, outRate);
    const channelData = buffer.getChannelData(0);

    const effectiveSrcRate = samplingFreqKhz * 1000 * pitchScale;
    const step = effectiveSrcRate / outRate;

    // Soft fade-in / fade-out envelope (25 ms) to avoid speaker clicks
    const fadeSamples = Math.min(Math.floor(outRate * 0.025), Math.floor(outSamples / 4));

    for (let i = 0; i < outSamples; i++) {
      const srcPos = (i * step) % usableLen;
      const idx0 = Math.floor(srcPos);
      const idx1 = (idx0 + 1) % usableLen;
      const frac = srcPos - idx0;

      const s0 = signal[usableStart + idx0];
      const s1 = signal[usableStart + idx1];
      let sample = (s0 + (s1 - s0) * frac) * norm * volume;

      if (i < fadeSamples) {
        sample *= i / fadeSamples;
      } else if (i > outSamples - fadeSamples) {
        sample *= (outSamples - i) / fadeSamples;
      }
      channelData[i] = sample;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => {
      if (this.activeSource === source) {
        this.activeSource = null;
      }
      options?.onEnded?.();
    };
    this.activeSource = source;
    source.start();
  }
}

export const labAudioPlayer = new LabAudioPlayer();
