// La Quiétude — the spoken-guidance engine.
//
// The script is a list of lines, each with the silence (pauseAfterMs) to hold
// AFTER it is spoken. The player schedules: voice the line → hold the timed
// silence → next line, so the total runtime lands near the chosen length.
//
// The VOICE itself comes from a pluggable engine:
//   • ClipAudioEngine     — plays a pre-rendered Edge-TTS MP3 clip per line.
//                           This is the primary path (catalogue séances): the
//                           same neural-voice flow the podcast-summaries app
//                           uses, with real studio-quality voices.
//   • BrowserSpeechEngine — the device's speechSynthesis, for the live
//                           "device voice" mode where any tuning can be voiced
//                           on the fly (quality depends on installed voices).
//
// Pause/resume SUSPEND the current line (clip or utterance) rather than
// restarting it. Everything is tear-down-safe.

export interface Voice {
  uri: string;
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
}

/** Voices can load asynchronously; resolve once they're available (or empty). */
export function loadVoices(): Promise<Voice[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve([]);
      return;
    }
    const get = () =>
      window.speechSynthesis.getVoices().map((v) => ({
        uri: v.voiceURI,
        name: v.name,
        lang: v.lang,
        localService: v.localService,
        default: v.default,
      }));

    const first = get();
    if (first.length > 0) {
      resolve(first);
      return;
    }
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve(get());
    };
    window.speechSynthesis.onvoiceschanged = done;
    setTimeout(done, 1200);
  });
}

export function hasSpeech(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Best default voice for a language: prefer a local, language-matching voice. */
export function pickDefaultVoice(voices: Voice[], lang: "fr" | "en"): string | null {
  if (voices.length === 0) return null;
  const wanted = lang === "fr" ? "fr" : "en";
  const matches = voices.filter((v) => v.lang.toLowerCase().startsWith(wanted));
  const pool = matches.length > 0 ? matches : voices;
  const local = pool.find((v) => v.localService);
  return (local ?? pool[0]).uri;
}

// ── voice engines ─────────────────────────────────────────────────────────────

/** A single in-progress spoken line. `ended` resolves when it finishes naturally
 *  (NOT when paused or stopped). pause()/resume() suspend and continue it. */
export interface VoiceHandle {
  ended: Promise<void>;
  pause(): void;
  resume(): void;
  stop(): void;
}

export interface VoiceEngine {
  play(text: string, index: number): VoiceHandle;
  /** Optional: hint the engine to preload an upcoming line's audio. */
  prepare?(index: number): void;
  dispose(): void;
}

export interface SpeakOptions {
  voiceURI: string | null;
  rate: number; // 0.6 .. 1.2
  pitch: number; // 0.6 .. 1.4
  lang: string; // e.g. "fr-CA"
}

/** Device speechSynthesis engine (live "device voice" mode). */
export class BrowserSpeechEngine implements VoiceEngine {
  private opts: SpeakOptions;
  private voices: Voice[];
  private current: SpeechSynthesisUtterance | null = null;
  private ok: boolean;

  constructor(opts: SpeakOptions, voices: Voice[]) {
    this.opts = opts;
    this.voices = voices;
    this.ok = hasSpeech() && opts.voiceURI !== null;
  }

  get usable(): boolean {
    return this.ok;
  }

  play(text: string): VoiceHandle {
    let resolve!: () => void;
    const ended = new Promise<void>((r) => (resolve = r));

    if (!this.ok) {
      // No usable voice: a silent read-along beat proportional to the text.
      const ms = Math.max(900, (text.length / 13) * 1000);
      const timer = setTimeout(resolve, ms);
      return {
        ended,
        pause: () => clearTimeout(timer),
        resume: () => {},
        stop: () => {
          clearTimeout(timer);
          resolve();
        },
      };
    }

    const u = new SpeechSynthesisUtterance(text);
    u.rate = this.opts.rate;
    u.pitch = this.opts.pitch;
    u.lang = this.opts.lang;
    const v = this.voices.find((x) => x.uri === this.opts.voiceURI);
    if (v) {
      const synthVoice = window.speechSynthesis
        .getVoices()
        .find((sv) => sv.voiceURI === v.uri);
      if (synthVoice) u.voice = synthVoice;
      u.lang = v.lang || this.opts.lang;
    }
    this.current = u;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (this.current === u) this.current = null;
      resolve();
    };
    u.onend = finish;
    u.onerror = finish;
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {
      finish();
    }
    return {
      ended,
      pause: () => {
        try {
          window.speechSynthesis.pause();
        } catch {
          /* noop */
        }
      },
      resume: () => {
        try {
          window.speechSynthesis.resume();
        } catch {
          /* noop */
        }
      },
      stop: () => {
        done = true;
        if (this.current === u) this.current = null;
        try {
          window.speechSynthesis.cancel();
        } catch {
          /* noop */
        }
        resolve();
      },
    };
  }

  dispose(): void {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* noop */
    }
    this.current = null;
  }
}

/** Pre-rendered MP3 clip engine. Plays one calm clip per line through a
 *  reusable <audio> element so playback is gapless and pausable. The clip's own
 *  volume is independent of the background bed. */
export class ClipAudioEngine implements VoiceEngine {
  private audio: HTMLAudioElement;
  private preloader: HTMLAudioElement;
  private urls: (string | null)[];
  private _volume: number;

  constructor(urls: (string | null)[], volume = 1) {
    this.urls = urls;
    this._volume = volume;
    this.audio = new Audio();
    this.audio.preload = "auto";
    this.audio.volume = volume;
    this.preloader = new Audio();
    this.preloader.preload = "auto";
  }

  setVolume(v: number): void {
    this._volume = v;
    this.audio.volume = v;
  }

  prepare(index: number): void {
    const url = this.urls[index];
    if (url) {
      try {
        this.preloader.src = url;
        this.preloader.load();
      } catch {
        /* noop */
      }
    }
  }

  play(_text: string, index: number): VoiceHandle {
    let resolve!: () => void;
    const ended = new Promise<void>((r) => (resolve = r));
    const url = this.urls[index];
    const a = this.audio;

    if (!url) {
      const timer = setTimeout(resolve, 400);
      return {
        ended,
        pause: () => clearTimeout(timer),
        resume: () => {},
        stop: () => {
          clearTimeout(timer);
          resolve();
        },
      };
    }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      cleanup();
      resolve();
    };
    const onEnded = () => finish();
    const onError = () => finish();
    const cleanup = () => {
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("error", onError);
    };
    a.addEventListener("ended", onEnded);
    a.addEventListener("error", onError);

    try {
      a.src = url;
      a.currentTime = 0;
      a.volume = this._volume;
      void a.play().catch(() => {
        /* autoplay rejection — 'ended'/'error' or stop() will resolve */
      });
    } catch {
      finish();
    }

    return {
      ended,
      pause: () => {
        try {
          a.pause();
        } catch {
          /* noop */
        }
      },
      resume: () => {
        void a.play().catch(() => {});
      },
      stop: () => {
        done = true;
        cleanup();
        try {
          a.pause();
        } catch {
          /* noop */
        }
        resolve();
      },
    };
  }

  dispose(): void {
    try {
      this.audio.pause();
      this.audio.removeAttribute("src");
      this.audio.load();
      this.preloader.removeAttribute("src");
    } catch {
      /* noop */
    }
  }
}

// ── the player ────────────────────────────────────────────────────────────────

export interface PlayerCallbacks {
  onLine?: (index: number, text: string) => void;
  onSilence?: () => void;
  onProgress?: (elapsedMs: number, totalMs: number) => void;
  onDone?: () => void;
  onState?: (state: "playing" | "paused" | "stopped" | "done") => void;
}

export interface PlayerLine {
  text: string;
  pauseAfterMs: number;
  /** Known voiced duration (ms) for accurate progress; estimated if absent. */
  knownMs?: number;
}

type StepKind = "line" | "silence";
interface Step {
  kind: StepKind;
  text?: string;
  lineNo: number; // for "line"; -1 for silence
  budget: number; // ms used for the progress bar
}

function estimateLineMs(text: string, rate: number): number {
  const base = (text.length / 13) * 1000;
  return Math.max(900, base / Math.max(0.5, rate));
}

export class GuidancePlayer {
  private steps: Step[] = [];
  private engine: VoiceEngine;
  private cbs: PlayerCallbacks;

  private idx = 0;
  private elapsedDone = 0; // ms from fully-completed steps
  private total = 0;
  private state: "playing" | "paused" | "stopped" | "done" = "stopped";

  private handle: VoiceHandle | null = null;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private progressTimer: ReturnType<typeof setInterval> | null = null;

  private stepStart = 0; // Date.now of the current play segment
  private stepBanked = 0; // ms accrued in this step before the current segment
  private stepBudget = 0;
  private skipFlag = false;

  constructor(
    lines: PlayerLine[],
    engine: VoiceEngine,
    cbs: PlayerCallbacks,
    rateForEstimate = 1,
  ) {
    this.engine = engine;
    this.cbs = cbs;

    let lineNo = 0;
    for (const l of lines) {
      const budget =
        l.knownMs && l.knownMs > 0 ? l.knownMs : estimateLineMs(l.text, rateForEstimate);
      this.steps.push({ kind: "line", text: l.text, lineNo, budget });
      this.total += budget;
      if (l.pauseAfterMs > 0) {
        this.steps.push({ kind: "silence", lineNo: -1, budget: l.pauseAfterMs });
        this.total += l.pauseAfterMs;
      }
      lineNo += 1;
    }
  }

  get totalMs(): number {
    return this.total;
  }

  start(): void {
    if (this.state === "playing") return;
    this.state = "playing";
    this.cbs.onState?.("playing");
    this.startProgressTicker();
    this.runStep();
  }

  private startProgressTicker(): void {
    if (this.progressTimer) clearInterval(this.progressTimer);
    this.progressTimer = setInterval(() => {
      if (this.state !== "playing") return;
      this.cbs.onProgress?.(Math.min(this.total, this.currentElapsed()), this.total);
    }, 200);
  }

  private currentElapsed(): number {
    const within =
      this.stepBanked + (this.state === "playing" ? Date.now() - this.stepStart : 0);
    return this.elapsedDone + Math.min(this.stepBudget, within);
  }

  private runStep(): void {
    if (this.state !== "playing") return;
    if (this.idx >= this.steps.length) {
      this.finish();
      return;
    }
    const step = this.steps[this.idx];
    this.stepStart = Date.now();
    this.stepBanked = 0;
    this.stepBudget = step.budget;
    this.skipFlag = false;

    if (step.kind === "line") {
      this.cbs.onLine?.(step.lineNo, step.text ?? "");
      // preload the next line's clip during this one
      const after = this.steps[this.idx + 1];
      const nextLine = after?.kind === "silence" ? this.steps[this.idx + 2] : after;
      if (nextLine?.kind === "line") this.engine.prepare?.(nextLine.lineNo);

      const h = this.engine.play(step.text ?? "", step.lineNo);
      this.handle = h;
      void h.ended.then(() => {
        if (this.handle !== h) return; // superseded by stop/skip
        this.handle = null;
        this.advance(this.measured());
      });
    } else {
      this.cbs.onSilence?.();
      this.armSilence(step.budget);
    }
  }

  private armSilence(remaining: number): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => {
      this.silenceTimer = null;
      this.advance(this.stepBudget);
    }, Math.max(0, remaining));
  }

  /** Actual ms spent in the current step so far. */
  private measured(): number {
    return this.stepBanked + (Date.now() - this.stepStart);
  }

  private advance(actualMs: number): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    this.elapsedDone += this.skipFlag ? this.stepBudget : actualMs;
    this.idx += 1;
    if (this.state === "playing") this.runStep();
  }

  /** Skip the current silence step. */
  skip(): void {
    if (this.state !== "playing") return;
    const step = this.steps[this.idx];
    if (!step || step.kind !== "silence") return;
    this.skipFlag = true;
    this.advance(this.stepBudget);
  }

  pause(): void {
    if (this.state !== "playing") return;
    this.state = "paused";
    this.cbs.onState?.("paused");
    // bank the time spent in this segment
    this.stepBanked += Date.now() - this.stepStart;
    if (this.handle) this.handle.pause();
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  resume(): void {
    if (this.state !== "paused") return;
    this.state = "playing";
    this.cbs.onState?.("playing");
    this.startProgressTicker();
    this.stepStart = Date.now();
    const step = this.steps[this.idx];
    if (!step) {
      this.finish();
      return;
    }
    if (step.kind === "line") {
      if (this.handle) this.handle.resume();
      else this.advance(this.measured()); // handle already ended at the pause edge
    } else {
      this.armSilence(step.budget - this.stepBanked);
    }
  }

  private finish(): void {
    this.cleanup();
    this.state = "done";
    this.elapsedDone = this.total;
    this.cbs.onProgress?.(this.total, this.total);
    this.cbs.onState?.("done");
    this.cbs.onDone?.();
  }

  stop(): void {
    this.cleanup();
    this.state = "stopped";
    this.cbs.onState?.("stopped");
  }

  private cleanup(): void {
    if (this.handle) {
      this.handle.stop();
      this.handle = null;
    }
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
    this.engine.dispose();
  }
}
