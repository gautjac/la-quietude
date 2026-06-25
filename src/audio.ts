// La Quiétude — the background bed mixer.
//
// Every bed is generative Web Audio — no sample files. Each is an independent
// "channel" with its own level gain; the user mixes them live against a master.
//
// The signal path is built for richness, not just sound:
//   bed → level → ┬─ dry ─────────────────────────┐
//                 └─ send → ┐                       ├→ busInput → comp → EQ
//                          convolver → reverbReturn ┘                    → saturation
//                                                                        → master → out
// A procedurally-generated stereo impulse gives every bed real space; pink and
// brown noise (not white) give the nature beds their natural spectrum; a gentle
// bus compressor + shelf EQ + soft saturation glue and warm the whole thing.
// Optional breath-sync makes the whole bed swell with the breath.
//
// Browsers block autoplay: nothing sounds until ensure()/resume() runs from a
// user gesture.

import type { BedId, BedLevels } from "./types";

const ALL_BEDS: BedId[] = [
  "rain",
  "ocean",
  "forest",
  "wind",
  "night",
  "fire",
  "drone",
  "hum",
  "bowls",
  "piano",
  "room",
];

// How much of each bed is sent to the reverb (0..1). Pads and struck tones get
// a lot of space; broadband nature beds keep mostly dry so they stay present.
const REVERB_SEND: Record<BedId, number> = {
  rain: 0.12,
  ocean: 0.18,
  forest: 0.2,
  wind: 0.18,
  night: 0.22,
  fire: 0.12,
  drone: 0.4,
  hum: 0.34,
  bowls: 0.62,
  piano: 0.46,
  room: 0.1,
};

// ── noise ─────────────────────────────────────────────────────────────────────

/** A stereo AudioBuffer filled with pink or brown noise (independent L/R for a
 *  wide, decorrelated field). Pink ≈ natural rain/wind; brown ≈ deep surge. */
function makeNoise(ctx: AudioContext, seconds: number, kind: "pink" | "brown"): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    if (kind === "pink") {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    } else {
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        data[i] = last * 3.5;
      }
    }
  }
  return buf;
}

/** A procedural stereo impulse response: decaying noise. No file needed. */
function makeReverbIR(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      // a short pre-delay-ish softening at the very front, then exp decay
      const env = Math.pow(1 - t, decay) * (i < ctx.sampleRate * 0.01 ? i / (ctx.sampleRate * 0.01) : 1);
      data[i] = (Math.random() * 2 - 1) * env;
    }
  }
  return buf;
}

/** A gentle tanh saturation curve for analog-ish warmth. */
function makeSaturationCurve(amount: number): Float32Array {
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
  }
  return curve;
}

function breathe(
  ctx: AudioContext,
  param: AudioParam,
  base: number,
  depth: number,
  periodSec: number,
): OscillatorNode {
  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 1 / periodSec;
  const amp = ctx.createGain();
  amp.gain.value = depth;
  param.value = base;
  lfo.connect(amp).connect(param);
  lfo.start();
  return lfo;
}

interface Stoppable {
  stop: (t: number) => void;
}
interface Channel {
  level: GainNode;
  dry: GainNode;
  send: GainNode;
  nodes: Stoppable[];
}

// ── bed builders ───────────────────────────────────────────────────────────────
// Each builds into `out` (the channel level) and returns stoppable handles.

function noiseSource(ctx: AudioContext, buffer: AudioBuffer): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  return src;
}

interface NoiseCfg {
  type: BiquadFilterType;
  freq: number;
  q: number;
  hp?: number;
  swingHz?: number;
  swingPeriod?: number;
  gainSwing?: number;
  gainPeriod?: number;
  inner: number;
  pan?: number; // slow stereo sweep period (s); omit for static
}

function buildNoiseBed(
  ctx: AudioContext,
  noise: AudioBuffer,
  out: AudioNode,
  cfg: NoiseCfg,
): Stoppable[] {
  const src = noiseSource(ctx, noise);
  const filt = ctx.createBiquadFilter();
  filt.type = cfg.type;
  filt.frequency.value = cfg.freq;
  filt.Q.value = cfg.q;

  let chain: AudioNode = src;
  chain.connect(filt);
  chain = filt;

  if (cfg.hp) {
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = cfg.hp;
    chain.connect(hp);
    chain = hp;
  }

  const inner = ctx.createGain();
  inner.gain.value = cfg.inner;
  chain.connect(inner);

  const lfos: OscillatorNode[] = [];
  let tail: AudioNode = inner;
  if (cfg.pan) {
    const panner = ctx.createStereoPanner();
    inner.connect(panner);
    lfos.push(breathe(ctx, panner.pan, 0, 0.6, cfg.pan));
    tail = panner;
  }
  tail.connect(out);

  if (cfg.swingHz && cfg.swingPeriod) {
    lfos.push(breathe(ctx, filt.frequency, cfg.freq, cfg.swingHz, cfg.swingPeriod));
  }
  if (cfg.gainSwing && cfg.gainPeriod) {
    lfos.push(breathe(ctx, inner.gain, cfg.inner, cfg.inner * cfg.gainSwing, cfg.gainPeriod));
  }

  src.start();
  return [
    {
      stop: (t) => {
        try {
          src.stop(t);
        } catch {
          /* noop */
        }
        lfos.forEach((l) => {
          try {
            l.stop(t);
          } catch {
            /* noop */
          }
        });
      },
    },
  ];
}

/** Sparse, randomly-panned transient generator (droplets, chirps, crackle). */
function buildSparse(
  ctx: AudioContext,
  out: AudioNode,
  opts: {
    minGap: number;
    maxGap: number;
    burst?: number; // chance of a quick second hit
    make: (now: number, panner: StereoPannerNode) => void;
  },
): Stoppable[] {
  let alive = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const fire = () => {
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.random() * 1.6 - 0.8;
    panner.connect(out);
    opts.make(ctx.currentTime, panner);
  };
  const next = () => {
    if (!alive) return;
    timer = setTimeout(
      () => {
        if (!alive) return;
        fire();
        if (opts.burst && Math.random() < opts.burst) {
          setTimeout(() => alive && fire(), 90 + Math.random() * 220);
        }
        next();
      },
      opts.minGap + Math.random() * (opts.maxGap - opts.minGap),
    );
  };
  next();
  return [
    {
      stop: () => {
        alive = false;
        if (timer) clearTimeout(timer);
      },
    },
  ];
}

function buildRain(ctx: AudioContext, pink: AudioBuffer, brown: AudioBuffer, out: AudioNode): Stoppable[] {
  // fine hiss (pink, high-passed) + a distant low rumble (brown) + droplets
  const hiss = buildNoiseBed(ctx, pink, out, {
    type: "highpass",
    freq: 1100,
    q: 0.7,
    hp: 700,
    gainSwing: 0.18,
    gainPeriod: 13,
    inner: 0.34,
  });
  const rumble = buildNoiseBed(ctx, brown, out, {
    type: "lowpass",
    freq: 220,
    q: 0.5,
    gainSwing: 0.25,
    gainPeriod: 17,
    inner: 0.12,
  });
  const drops = buildSparse(ctx, out, {
    minGap: 140,
    maxGap: 600,
    burst: 0.5,
    make: (now, panner) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      const f = 900 + Math.random() * 2600;
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.5, now + 0.05);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.05 + Math.random() * 0.05, now + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      osc.connect(g).connect(panner);
      osc.start(now);
      osc.stop(now + 0.09);
    },
  });
  return [...hiss, ...rumble, ...drops];
}

function buildOcean(ctx: AudioContext, brown: AudioBuffer, pink: AudioBuffer, out: AudioNode): Stoppable[] {
  // a low surge (brown) + a foam/hiss crest (pink) that swells together, with a
  // slow stereo drift so each wave moves across the field
  const surge = buildNoiseBed(ctx, brown, out, {
    type: "lowpass",
    freq: 320,
    q: 0.6,
    gainSwing: 0.85,
    gainPeriod: 9.3,
    inner: 0.5,
    pan: 19,
  });
  const foam = buildNoiseBed(ctx, pink, out, {
    type: "bandpass",
    freq: 1400,
    q: 0.5,
    gainSwing: 0.95,
    gainPeriod: 9.3,
    inner: 0.12,
    pan: 23,
  });
  return [...surge, ...foam];
}

function buildForest(ctx: AudioContext, pink: AudioBuffer, out: AudioNode): Stoppable[] {
  const bed = buildNoiseBed(ctx, pink, out, {
    type: "bandpass",
    freq: 540,
    q: 0.8,
    hp: 320,
    swingHz: 120,
    swingPeriod: 9,
    gainSwing: 0.3,
    gainPeriod: 11,
    inner: 0.24,
    pan: 27,
  });
  const birds = buildSparse(ctx, out, {
    minGap: 2200,
    maxGap: 7000,
    burst: 0.5,
    make: (now, panner) => {
      const f = 1900 + Math.random() * 1700;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.linearRampToValueAtTime(f * (1 + (Math.random() * 0.2 - 0.1)), now + 0.1);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.14, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
      osc.connect(g).connect(panner);
      osc.start(now);
      osc.stop(now + 0.2);
    },
  });
  return [...bed, ...birds];
}

function buildWind(ctx: AudioContext, pink: AudioBuffer, out: AudioNode): Stoppable[] {
  // band-passed pink with a slow formant sweep + gusting gain + wide stereo
  return buildNoiseBed(ctx, pink, out, {
    type: "bandpass",
    freq: 480,
    q: 1.6,
    swingHz: 260,
    swingPeriod: 13,
    gainSwing: 0.6,
    gainPeriod: 8,
    inner: 0.42,
    pan: 11,
  });
}

function buildNight(ctx: AudioContext, brown: AudioBuffer, out: AudioNode): Stoppable[] {
  // a low warm ground + sparse cricket trills high and wide
  const ground = buildNoiseBed(ctx, brown, out, {
    type: "lowpass",
    freq: 200,
    q: 0.5,
    gainSwing: 0.1,
    gainPeriod: 21,
    inner: 0.3,
  });
  const crickets = buildSparse(ctx, out, {
    minGap: 700,
    maxGap: 2600,
    burst: 0.7,
    make: (now, panner) => {
      const f = 4200 + Math.random() * 1200;
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.value = f;
      // amplitude trill via a fast gain wobble
      const g = ctx.createGain();
      g.gain.value = 0;
      const trill = ctx.createOscillator();
      trill.type = "sine";
      trill.frequency.value = 40;
      const trillAmp = ctx.createGain();
      trillAmp.gain.value = 0.04;
      trill.connect(trillAmp).connect(g.gain);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = f;
      bp.Q.value = 8;
      osc.connect(bp).connect(g).connect(panner);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.05, now + 0.02);
      g.gain.setValueAtTime(0.05, now + 0.18);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
      osc.start(now);
      trill.start(now);
      osc.stop(now + 0.34);
      trill.stop(now + 0.34);
    },
  });
  return [...ground, ...crickets];
}

function buildFire(ctx: AudioContext, brown: AudioBuffer, pink: AudioBuffer, out: AudioNode): Stoppable[] {
  // a low roar + frequent random crackle pops
  const roar = buildNoiseBed(ctx, brown, out, {
    type: "lowpass",
    freq: 420,
    q: 0.6,
    gainSwing: 0.4,
    gainPeriod: 3.5,
    inner: 0.34,
  });
  const crackle = buildSparse(ctx, out, {
    minGap: 60,
    maxGap: 420,
    burst: 0.6,
    make: (now, panner) => {
      const src = ctx.createBufferSource();
      // a tiny grain of pink noise = a pop
      src.buffer = pink;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1200 + Math.random() * 2600;
      bp.Q.value = 3;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.06 + Math.random() * 0.07, now + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.04 + Math.random() * 0.05);
      src.connect(bp).connect(g).connect(panner);
      src.start(now, Math.random() * 2);
      src.stop(now + 0.12);
    },
  });
  return [...roar, ...crackle];
}

function buildDrone(ctx: AudioContext, out: AudioNode, rootHz: number): Stoppable[] {
  // additive partials, spread across the stereo field, with slow detune drift
  // (chorus) and a sub for warmth + a slowly breathing low-pass
  const partials = [0.5, 1, 1.5, 2.01, 3.0, 4.02];
  const detunes = [0, 4, -3, 6, -5, 8];
  const pans = [0, -0.3, 0.3, -0.5, 0.5, -0.2];
  const oscs: OscillatorNode[] = [];
  const drifts: OscillatorNode[] = [];

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 900;
  lp.Q.value = 0.4;
  const sum = ctx.createGain();
  sum.gain.value = 0.5;
  lp.connect(sum).connect(out);
  const filtLfo = breathe(ctx, lp.frequency, 900, 360, 19);

  partials.forEach((mult, idx) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = rootHz * mult;
    osc.detune.value = detunes[idx];
    // slow detune drift for a living chorus
    const drift = ctx.createOscillator();
    drift.type = "sine";
    drift.frequency.value = 0.05 + Math.random() * 0.08;
    const driftAmp = ctx.createGain();
    driftAmp.gain.value = 4 + Math.random() * 5;
    drift.connect(driftAmp).connect(osc.detune);
    drift.start();
    drifts.push(drift);

    const og = ctx.createGain();
    og.gain.value = 0.5 / (idx + 1.5);
    const panner = ctx.createStereoPanner();
    panner.pan.value = pans[idx];
    osc.connect(og).connect(panner).connect(lp);
    osc.start();
    oscs.push(osc);
  });

  const ampLfo = breathe(ctx, sum.gain, 0.5, 0.18, 16);

  return [
    {
      stop: (t: number) => {
        [...oscs, ...drifts, ampLfo, filtLfo].forEach((o) => {
          try {
            o.stop(t);
          } catch {
            /* noop */
          }
        });
      },
    },
  ];
}

function buildHum(ctx: AudioContext, out: AudioNode): Stoppable[] {
  // a vocal-ish "Om": a low fundamental shaped by two formant band-passes
  const root = 110;
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.value = root;
  const sub = ctx.createOscillator();
  sub.type = "sine";
  sub.frequency.value = root / 2;

  const mix = ctx.createGain();
  mix.gain.value = 0.16;
  const subG = ctx.createGain();
  subG.gain.value = 0.12;
  osc.connect(mix);
  sub.connect(subG).connect(out);

  const f1 = ctx.createBiquadFilter();
  f1.type = "bandpass";
  f1.frequency.value = 320;
  f1.Q.value = 6;
  const f2 = ctx.createBiquadFilter();
  f2.type = "bandpass";
  f2.frequency.value = 760;
  f2.Q.value = 8;
  mix.connect(f1).connect(out);
  mix.connect(f2).connect(out);

  const f1Lfo = breathe(ctx, f1.frequency, 320, 60, 14);
  const ampLfo = breathe(ctx, mix.gain, 0.16, 0.05, 11);
  osc.start();
  sub.start();

  return [
    {
      stop: (t: number) => {
        [osc, sub, f1Lfo, ampLfo].forEach((o) => {
          try {
            o.stop(t);
          } catch {
            /* noop */
          }
        });
      },
    },
  ];
}

/** Sparse singing-bowl strikes: inharmonic partials with long beating decays. */
function buildBowls(ctx: AudioContext, out: AudioNode): Stoppable[] {
  let alive = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const roots = [196, 220, 261.63, 293.66, 329.63];
  // inharmonic ratios typical of a struck metal bowl
  const ratios = [1, 2.76, 5.4, 8.9];

  const strike = (root: number) => {
    const now = ctx.currentTime;
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.random() * 1.2 - 0.6;
    panner.connect(out);
    ratios.forEach((r, idx) => {
      const f = root * r;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f;
      // a second, slightly detuned partial → slow beating shimmer
      const osc2 = ctx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.value = f * 1.003;
      const g = ctx.createGain();
      const peak = 0.5 / (idx + 1.4);
      const dur = 7 - idx * 1.1;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(peak, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(g);
      osc2.connect(g);
      g.connect(panner);
      osc.start(now);
      osc2.start(now);
      osc.stop(now + dur + 0.1);
      osc2.stop(now + dur + 0.1);
    });
  };

  const next = () => {
    if (!alive) return;
    timer = setTimeout(
      () => {
        if (!alive) return;
        strike(roots[Math.floor(Math.random() * roots.length)]);
        next();
      },
      6000 + Math.random() * 9000,
    );
  };
  // first strike soon so the bed announces itself
  timer = setTimeout(() => alive && strike(roots[0]), 400);
  next();

  return [
    {
      stop: () => {
        alive = false;
        if (timer) clearTimeout(timer);
      },
    },
  ];
}

function buildPiano(ctx: AudioContext, out: AudioNode): Stoppable[] {
  let alive = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const scale = [196, 220, 261.63, 293.66, 329.63, 392, 440, 523.25];

  function note(freq: number) {
    const now = ctx.currentTime;
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.random() * 1.0 - 0.5;
    panner.connect(out);

    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = freq * 2.0;

    const g = ctx.createGain();
    g.gain.value = 0;
    const g2 = ctx.createGain();
    g2.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2400;
    osc.connect(g).connect(lp);
    osc2.connect(g2).connect(lp);
    lp.connect(panner);

    const peak = 0.5;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(peak, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 4.2);
    g2.gain.setValueAtTime(0, now);
    g2.gain.linearRampToValueAtTime(peak * 0.18, now + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + 4.4);
    osc2.stop(now + 4.4);
  }

  function next() {
    if (!alive) return;
    const wait = 2600 + Math.random() * 4200;
    timer = setTimeout(() => {
      if (!alive) return;
      note(scale[Math.floor(Math.random() * scale.length)]);
      if (Math.random() > 0.6) {
        setTimeout(() => {
          if (alive) note(scale[Math.floor(Math.random() * scale.length)]);
        }, 320 + Math.random() * 280);
      }
      next();
    }, wait);
  }
  next();
  return [
    {
      stop: () => {
        alive = false;
        if (timer) clearTimeout(timer);
      },
    },
  ];
}

// ── the mixer ───────────────────────────────────────────────────────────────

export class BedMixer {
  private ctx: AudioContext | null = null;
  private busInput: GainNode | null = null;
  private reverbIn: GainNode | null = null;
  private master: GainNode | null = null;
  private fx: GainNode | null = null;
  private pink: AudioBuffer | null = null;
  private brown: AudioBuffer | null = null;
  private channels = new Map<BedId, Channel>();
  private levels: BedLevels;
  private _master: number;
  private started = false;

  // breath-sync
  private breathLfo: OscillatorNode | null = null;
  private breathDepth: GainNode | null = null;

  constructor(levels: BedLevels, master: number) {
    this.levels = { ...levels };
    this._master = master;
  }

  get isStarted(): boolean {
    return this.started;
  }

  async ensure(): Promise<void> {
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.pink = makeNoise(this.ctx, 12, "pink");
      this.brown = makeNoise(this.ctx, 16, "brown");

      // master bus: busInput → comp → low-shelf → high-shelf → saturation → master → out
      this.busInput = this.ctx.createGain();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -22;
      comp.knee.value = 22;
      comp.ratio.value = 2.4;
      comp.attack.value = 0.05;
      comp.release.value = 0.4;
      const low = this.ctx.createBiquadFilter();
      low.type = "lowshelf";
      low.frequency.value = 140;
      low.gain.value = 1.5;
      const high = this.ctx.createBiquadFilter();
      high.type = "highshelf";
      high.frequency.value = 6500;
      high.gain.value = -2.5;
      const shaper = this.ctx.createWaveShaper();
      shaper.curve = makeSaturationCurve(1.6) as Float32Array<ArrayBuffer>;
      shaper.oversample = "2x";
      this.master = this.ctx.createGain();
      this.master.gain.value = this._master;

      this.busInput.connect(comp).connect(low).connect(high).connect(shaper).connect(this.master);
      this.master.connect(this.ctx.destination);

      // reverb send bus
      this.reverbIn = this.ctx.createGain();
      const convolver = this.ctx.createConvolver();
      convolver.buffer = makeReverbIR(this.ctx, 3.2, 2.6);
      const reverbReturn = this.ctx.createGain();
      reverbReturn.gain.value = 0.9;
      this.reverbIn.connect(convolver).connect(reverbReturn).connect(this.busInput);

      // fx bus for chime/cue: always audible (bypasses bed master), still reverbed
      this.fx = this.ctx.createGain();
      this.fx.gain.value = 1;
      this.fx.connect(this.ctx.destination);
      this.fx.connect(this.reverbIn);
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();
    for (const id of ALL_BEDS) {
      if (this.levels[id] > 0 && !this.channels.has(id)) this.spinUp(id);
    }
    this.started = true;
  }

  private spinUp(id: BedId): void {
    if (!this.ctx || !this.busInput || !this.reverbIn || !this.pink || !this.brown) return;
    const ctx = this.ctx;
    const level = ctx.createGain();
    const now = ctx.currentTime;
    level.gain.setValueAtTime(0, now);
    level.gain.linearRampToValueAtTime(this.levels[id], now + 1.5);

    const dry = ctx.createGain();
    dry.gain.value = 1;
    level.connect(dry).connect(this.busInput);
    const send = ctx.createGain();
    send.gain.value = REVERB_SEND[id];
    level.connect(send).connect(this.reverbIn);

    let nodes: Stoppable[];
    switch (id) {
      case "rain":
        nodes = buildRain(ctx, this.pink, this.brown, level);
        break;
      case "ocean":
        nodes = buildOcean(ctx, this.brown, this.pink, level);
        break;
      case "forest":
        nodes = buildForest(ctx, this.pink, level);
        break;
      case "wind":
        nodes = buildWind(ctx, this.pink, level);
        break;
      case "night":
        nodes = buildNight(ctx, this.brown, level);
        break;
      case "fire":
        nodes = buildFire(ctx, this.brown, this.pink, level);
        break;
      case "drone":
        nodes = buildDrone(ctx, level, 96);
        break;
      case "hum":
        nodes = buildHum(ctx, level);
        break;
      case "bowls":
        nodes = buildBowls(ctx, level);
        break;
      case "piano":
        nodes = buildPiano(ctx, level);
        break;
      case "room":
        nodes = buildNoiseBed(ctx, this.brown, level, {
          type: "lowpass",
          freq: 160,
          q: 0.5,
          gainSwing: 0.08,
          gainPeriod: 19,
          inner: 0.5,
        });
        break;
      default:
        nodes = [];
    }
    this.channels.set(id, { level, dry, send, nodes });
  }

  private spinDown(id: BedId): void {
    const ch = this.channels.get(id);
    if (!ch || !this.ctx) return;
    const now = this.ctx.currentTime;
    ch.level.gain.cancelScheduledValues(now);
    ch.level.gain.setValueAtTime(ch.level.gain.value, now);
    ch.level.gain.linearRampToValueAtTime(0, now + 1.0);
    const at = now + 1.2;
    ch.nodes.forEach((n) => n.stop(at));
    this.channels.delete(id);
  }

  async setBed(id: BedId, value: number): Promise<void> {
    this.levels[id] = value;
    if (!this.ctx) return;
    if (value <= 0.0001) {
      this.spinDown(id);
      return;
    }
    if (!this.channels.has(id)) {
      if (this.ctx.state === "suspended") await this.ctx.resume();
      this.spinUp(id);
      return;
    }
    const ch = this.channels.get(id);
    if (ch) ch.level.gain.setTargetAtTime(value, this.ctx.currentTime, 0.08);
  }

  setMaster(v: number): void {
    this._master = v;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
      if (this.breathDepth) this.breathDepth.gain.setTargetAtTime(v * 0.18, this.ctx.currentTime, 0.05);
    }
  }

  /** Make the whole bed swell with the breath. period = one in+out cycle (s);
   *  null turns it off. */
  setBreath(periodSec: number | null): void {
    if (!this.ctx || !this.master) return;
    // tear down any existing LFO
    if (this.breathLfo) {
      try {
        this.breathLfo.stop();
      } catch {
        /* noop */
      }
      this.breathLfo.disconnect();
      this.breathLfo = null;
    }
    if (this.breathDepth) {
      this.breathDepth.disconnect();
      this.breathDepth = null;
    }
    if (!periodSec) return;
    const lfo = this.ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 1 / periodSec;
    const depth = this.ctx.createGain();
    depth.gain.value = this._master * 0.18;
    lfo.connect(depth).connect(this.master.gain);
    lfo.start();
    this.breathLfo = lfo;
    this.breathDepth = depth;
  }

  silence(): void {
    for (const id of [...this.channels.keys()]) this.spinDown(id);
    this.started = false;
  }

  async fadeOut(seconds: number): Promise<void> {
    this.setBreath(null);
    if (!this.ctx || !this.master) {
      this.silence();
      return;
    }
    const now = this.ctx.currentTime;
    const g = this.master.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(0.0001, g.value), now);
    g.setTargetAtTime(0.0001, now, Math.max(0.5, seconds) / 4);
    await new Promise((r) => setTimeout(r, seconds * 1000));
    this.silence();
  }

  async dispose(): Promise<void> {
    this.setBreath(null);
    this.silence();
    if (this.ctx) {
      try {
        await this.ctx.close();
      } catch {
        /* noop */
      }
      this.ctx = null;
      this.busInput = null;
      this.reverbIn = null;
      this.master = null;
      this.fx = null;
      this.pink = null;
      this.brown = null;
    }
    this.channels.clear();
  }

  /** A soft two-note end chime — through the fx bus + reverb, always audible. */
  async chime(): Promise<void> {
    await this.ensure();
    if (!this.ctx || !this.fx) return;
    const now = this.ctx.currentTime;
    const ring = (freq: number, delay: number, dur: number) => {
      const osc = this.ctx!.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const g = this.ctx!.createGain();
      g.gain.value = 0;
      osc.connect(g).connect(this.fx!);
      const t = now + delay;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.start(t);
      osc.stop(t + dur + 0.1);
    };
    ring(528, 0, 3.4);
    ring(792, 0.18, 3.8);
  }

  /** A soft breath cue: a gentle gliding tone, rising on inhale, falling on
   *  exhale. Through the fx bus so it's audible with the bed off. */
  async cue(direction: "in" | "out"): Promise<void> {
    await this.ensure();
    if (!this.ctx || !this.fx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    const f0 = direction === "in" ? 396 : 540;
    const f1 = direction === "in" ? 540 : 396;
    osc.frequency.setValueAtTime(f0, now);
    osc.frequency.exponentialRampToValueAtTime(f1, now + 0.55);
    const g = this.ctx.createGain();
    g.gain.value = 0;
    osc.connect(g).connect(this.fx);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.1, now + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
    osc.start(now);
    osc.stop(now + 0.85);
  }
}
