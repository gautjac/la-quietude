// La Quiétude — the background bed mixer.
//
// Every bed is generative Web Audio: filtered noise, tuned drones, sparse
// piano partials. No sample files, no audio API. Each bed is an independent
// "channel" with its own GainNode; the user mixes them live against a master.
// Modelled on la-fenetre's Soundscaper, rebuilt as a per-channel mixer so the
// guidance voice (speechSynthesis, elsewhere) stays fully independent.
//
// Browsers block autoplay: nothing makes sound until ensure()/resume() runs
// from a user gesture.

import type { BedId, BedLevels } from "./types";

const ALL_BEDS: BedId[] = ["rain", "drone", "piano", "ocean", "room", "forest"];

function makeNoiseBuffer(ctx: AudioContext, seconds = 5): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = 0.98 * last + 0.02 * white;
    data[i] = (white * 0.25 + last * 2.0) * 0.5;
  }
  return buf;
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

interface Channel {
  /** input gain to set the bed's own level (0..1). */
  level: GainNode;
  nodes: { stop: (t: number) => void }[];
}

// ── individual bed builders ─────────────────────────────────────────────────

function buildNoiseBed(
  ctx: AudioContext,
  noise: AudioBuffer,
  out: AudioNode,
  cfg: {
    type: BiquadFilterType;
    freq: number;
    q: number;
    hp?: number;
    swingHz?: number;
    swingPeriod?: number;
    gainSwing?: number;
    gainPeriod?: number;
    inner: number;
  },
): { stop: (t: number) => void }[] {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;

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
  chain.connect(inner).connect(out);

  const lfos: OscillatorNode[] = [];
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

function buildDrone(ctx: AudioContext, out: AudioNode, rootHz: number) {
  const partials = [1, 1.5, 2.01, 3.0];
  const detunes = [0, 4, -3, 6];
  const oscs: OscillatorNode[] = [];
  const sum = ctx.createGain();
  sum.gain.value = 0.5;
  sum.connect(out);

  partials.forEach((mult, idx) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = rootHz * mult;
    osc.detune.value = detunes[idx];
    const og = ctx.createGain();
    og.gain.value = 0.5 / (idx + 1.5);
    osc.connect(og).connect(sum);
    osc.start();
    oscs.push(osc);
  });

  const lfo = breathe(ctx, sum.gain, 0.5, 0.18, 16);

  return [
    {
      stop: (t: number) => {
        [...oscs, lfo].forEach((o) => {
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

/** A sparse, self-scheduling generative piano: soft sine-ish notes from a
 *  pentatonic set, with long decays. Returns a stoppable handle. */
function buildPiano(ctx: AudioContext, out: AudioNode): { stop: (t: number) => void }[] {
  let alive = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  // C-major pentatonic across a calm middle register.
  const scale = [196, 220, 261.63, 293.66, 329.63, 392, 440, 523.25];

  function note(freq: number) {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    // a second, quieter partial for body
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
    lp.connect(out);

    const peak = 0.5;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(peak, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 3.6);
    g2.gain.setValueAtTime(0, now);
    g2.gain.linearRampToValueAtTime(peak * 0.18, now + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + 3.8);
    osc2.stop(now + 3.8);
  }

  function next() {
    if (!alive) return;
    const wait = 2600 + Math.random() * 4200;
    timer = setTimeout(() => {
      if (!alive) return;
      note(scale[Math.floor(Math.random() * scale.length)]);
      // occasional gentle interval
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

function buildOcean(ctx: AudioContext, noise: AudioBuffer, out: AudioNode) {
  // Low surge with strong slow gain breathing → waves.
  return buildNoiseBed(ctx, noise, out, {
    type: "lowpass",
    freq: 320,
    q: 0.6,
    gainSwing: 0.85,
    gainPeriod: 8.5,
    inner: 0.5,
  });
}

function buildForest(ctx: AudioContext, noise: AudioBuffer, out: AudioNode) {
  const beds = buildNoiseBed(ctx, noise, out, {
    type: "bandpass",
    freq: 520,
    q: 0.8,
    hp: 300,
    swingHz: 120,
    swingPeriod: 9,
    gainSwing: 0.3,
    gainPeriod: 11,
    inner: 0.28,
  });
  // sparse birdsong accents
  let alive = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  function chirp() {
    const now = ctx.currentTime;
    const f = 1900 + Math.random() * 1700;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = 0;
    osc.connect(g).connect(out);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.16, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    osc.start(now);
    osc.stop(now + 0.2);
  }
  function next() {
    if (!alive) return;
    timer = setTimeout(() => {
      if (!alive) return;
      chirp();
      if (Math.random() > 0.5) setTimeout(() => alive && chirp(), 150);
      next();
    }, 2500 + Math.random() * 6000);
  }
  next();
  return [
    ...beds,
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
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private channels = new Map<BedId, Channel>();
  private levels: BedLevels;
  private _master: number;
  private started = false;

  constructor(levels: BedLevels, master: number) {
    this.levels = { ...levels };
    this._master = master;
  }

  get isStarted(): boolean {
    return this.started;
  }

  /** Must run from a user gesture. Builds the graph (idempotent). */
  async ensure(): Promise<void> {
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._master;
      this.master.connect(this.ctx.destination);
      this.noise = makeNoiseBuffer(this.ctx);
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();
    // build any bed whose level > 0 and not yet running
    for (const id of ALL_BEDS) {
      if (this.levels[id] > 0 && !this.channels.has(id)) this.spinUp(id);
    }
    this.started = true;
  }

  private spinUp(id: BedId): void {
    if (!this.ctx || !this.master || !this.noise) return;
    const level = this.ctx.createGain();
    const now = this.ctx.currentTime;
    level.gain.setValueAtTime(0, now);
    level.gain.linearRampToValueAtTime(this.levels[id], now + 1.5);
    level.connect(this.master);

    let nodes: { stop: (t: number) => void }[];
    switch (id) {
      case "rain":
        nodes = buildNoiseBed(this.ctx, this.noise, level, {
          type: "highpass",
          freq: 1100,
          q: 0.7,
          hp: 700,
          gainSwing: 0.15,
          gainPeriod: 13,
          inner: 0.4,
        });
        break;
      case "drone":
        nodes = buildDrone(this.ctx, level, 96);
        break;
      case "piano":
        nodes = buildPiano(this.ctx, level);
        break;
      case "ocean":
        nodes = buildOcean(this.ctx, this.noise, level);
        break;
      case "room":
        nodes = buildNoiseBed(this.ctx, this.noise, level, {
          type: "lowpass",
          freq: 160,
          q: 0.5,
          gainSwing: 0.08,
          gainPeriod: 19,
          inner: 0.5,
        });
        break;
      case "forest":
        nodes = buildForest(this.ctx, this.noise, level);
        break;
      default:
        nodes = [];
    }
    this.channels.set(id, { level, nodes });
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

  /** Set one bed's level (0..1). Spins it up / down as needed. */
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
    }
  }

  /** Gently ramp the master to silence over `seconds`, then stop the beds.
   *  Used to end sleep séances (and the sleep timer) without a jarring cut or
   *  chime. Resolves once the fade has completed. */
  async fadeOut(seconds: number): Promise<void> {
    if (!this.ctx || !this.master) {
      this.silence();
      return;
    }
    const now = this.ctx.currentTime;
    const g = this.master.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(0.0001, g.value), now);
    // exponential approach for a natural perceptual fade
    g.setTargetAtTime(0.0001, now, Math.max(0.5, seconds) / 4);
    await new Promise((r) => setTimeout(r, seconds * 1000));
    this.silence();
  }

  /** Stop all beds but keep the context for a quick restart. */
  silence(): void {
    for (const id of [...this.channels.keys()]) this.spinDown(id);
    this.started = false;
  }

  async dispose(): Promise<void> {
    this.silence();
    if (this.ctx) {
      try {
        await this.ctx.close();
      } catch {
        /* noop */
      }
      this.ctx = null;
      this.master = null;
      this.noise = null;
    }
    this.channels.clear();
  }

  /** A soft two-note end chime (Web Audio), independent of the beds. */
  async chime(): Promise<void> {
    await this.ensure();
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const ring = (freq: number, delay: number, dur: number) => {
      const osc = this.ctx!.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const g = this.ctx!.createGain();
      g.gain.value = 0;
      osc.connect(g).connect(this.master!);
      const t = now + delay;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.start(t);
      osc.stop(t + dur + 0.1);
    };
    ring(528, 0, 3.2);
    ring(792, 0.18, 3.6);
  }

  /** A soft breath cue: a gentle gliding tone, rising on the inhale, falling on
   *  the exhale. Routed to the output independently of the bed volume so it's
   *  audible even with the bed off. */
  async cue(direction: "in" | "out"): Promise<void> {
    await this.ensure();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    const f0 = direction === "in" ? 396 : 540;
    const f1 = direction === "in" ? 540 : 396;
    osc.frequency.setValueAtTime(f0, now);
    osc.frequency.exponentialRampToValueAtTime(f1, now + 0.55);
    const g = this.ctx.createGain();
    g.gain.value = 0;
    osc.connect(g).connect(this.ctx.destination);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.1, now + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
    osc.start(now);
    osc.stop(now + 0.85);
  }
}
