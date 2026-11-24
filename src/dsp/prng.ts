/**
 * Deterministic Mulberry32 PRNG and Box-Muller Gaussian noise generator.
 * Ensures exact reproducibility across single runs and Monte Carlo sweeps.
 */
export class SeededRandom {
  private state: number;
  private spareGaussian: number | null = null;

  constructor(seed: number) {
    this.state = (Math.floor(seed) >>> 0) || 1;
  }

  /** Uniform random float in [0, 1) */
  nextUniform(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Standard normal Gaussian N(0, 1) via Box-Muller transform */
  nextGaussian(): number {
    if (this.spareGaussian !== null) {
      const val = this.spareGaussian;
      this.spareGaussian = null;
      return val;
    }

    let u1 = 0;
    let u2 = 0;
    while (u1 <= 1e-12) {
      u1 = this.nextUniform();
    }
    u2 = this.nextUniform();

    const r = Math.sqrt(-2.0 * Math.log(u1));
    const theta = 2.0 * Math.PI * u2;
    this.spareGaussian = r * Math.sin(theta);
    return r * Math.cos(theta);
  }

  /** Generate an AWGN vector with zero mean and standard deviation sigma */
  generateAwgn(length: number, sigma: number): Float64Array {
    const out = new Float64Array(length);
    if (sigma <= 0) {
      return out;
    }
    for (let i = 0; i < length; i++) {
      out[i] = this.nextGaussian() * sigma;
    }
    return out;
  }
}
