// La Quiétude — the spoken-guidance engine, built on the browser's
// speechSynthesis. Voice quality depends entirely on the OS voices installed;
// we are honest about that in the UI. The Player schedules each line as an
// utterance, then holds a timed silence (pauseAfterMs) before the next — so the
// total runtime lands near the chosen length. Everything here is pausable and
// fully tear-down-safe.

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
    // Fallback: some browsers never fire the event.
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

export interface SpeakOptions {
  voiceURI: string | null;
  rate: number; // 0.6 .. 1.2
  pitch: number; // 0.6 .. 1.4
  lang: string; // e.g. "fr-CA"
}

type StepKind = "line" | "silence";

interface Step {
  kind: StepKind;
  text?: string;
  ms: number; // for silence, the pause; for line, an estimate used for progress
}

export interface PlayerCallbacks {
  onLine?: (index: number, text: string) => void;
  onSilence?: () => void;
  onProgress?: (elapsedMs: number, totalMs: number) => void;
  onDone?: () => void;
  onState?: (state: "playing" | "paused" | "stopped" | "done") => void;
}

interface PlayerLine {
  text: string;
  pauseAfterMs: number;
}

/** Roughly estimate how long a line will take to speak, for the progress bar. */
function estimateLineMs(text: string, rate: number): number {
  // ~13 chars/sec at rate 1; clamp for very short lines.
  const base = (text.length / 13) * 1000;
  return Math.max(900, base / Math.max(0.5, rate));
}

export class GuidancePlayer {
  private steps: Step[] = [];
  private lineIndices: number[] = []; // step idx → line number for callbacks
  private opts: SpeakOptions;
  private cbs: PlayerCallbacks;
  private voices: Voice[];

  private idx = 0;
  private elapsed = 0;
  private total = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private state: "playing" | "paused" | "stopped" | "done" = "stopped";
  private skipFlag = false;
  private progressTimer: ReturnType<typeof setInterval> | null = null;
  private stepStart = 0;
  private stepBudget = 0;
  private speechOK: boolean;

  constructor(
    lines: PlayerLine[],
    opts: SpeakOptions,
    voices: Voice[],
    cbs: PlayerCallbacks,
  ) {
    this.opts = opts;
    this.cbs = cbs;
    this.voices = voices;
    this.speechOK = hasSpeech();

    let lineNo = 0;
    for (const l of lines) {
      const ms = estimateLineMs(l.text, opts.rate);
      this.steps.push({ kind: "line", text: l.text, ms });
      this.lineIndices.push(lineNo);
      this.total += ms;
      if (l.pauseAfterMs > 0) {
        this.steps.push({ kind: "silence", ms: l.pauseAfterMs });
        this.lineIndices.push(-1);
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
      const within = Math.min(this.stepBudget, Date.now() - this.stepStart);
      this.cbs.onProgress?.(Math.min(this.total, this.elapsed + within), this.total);
    }, 200);
  }

  private runStep(): void {
    if (this.state !== "playing") return;
    if (this.idx >= this.steps.length) {
      this.finish();
      return;
    }
    const step = this.steps[this.idx];
    this.stepStart = Date.now();
    this.stepBudget = step.ms;
    this.skipFlag = false;

    if (step.kind === "line" && step.text) {
      const ln = this.lineIndices[this.idx];
      this.cbs.onLine?.(ln, step.text);
      if (this.speechOK && this.opts.voiceURI !== null) {
        this.speakLine(step.text, step.ms);
      } else {
        // No usable voice: degrade to a read-along timer of the estimate.
        this.timer = setTimeout(() => this.advance(step.ms), step.ms);
      }
    } else {
      // silence
      this.cbs.onSilence?.();
      this.timer = setTimeout(() => this.advance(step.ms), step.ms);
    }
  }

  private speakLine(text: string, estMs: number): void {
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
    let advanced = false;
    const go = () => {
      if (advanced) return;
      advanced = true;
      // measured time for a line replaces the estimate for accuracy
      const measured = Date.now() - this.stepStart;
      this.advance(measured > 0 ? measured : estMs);
    };
    u.onend = go;
    u.onerror = go;
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {
      // if speak throws, fall back to the timer
      this.timer = setTimeout(go, estMs);
    }
    // safety net: if onend never fires, advance after estimate + slack
    this.timer = setTimeout(go, estMs + 4000);
  }

  private advance(actualMs: number): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.elapsed += this.skipFlag ? this.stepBudget : actualMs;
    this.idx += 1;
    if (this.state === "playing") this.runStep();
  }

  /** Skip the current step (used to skip a long silence). */
  skip(): void {
    if (this.state !== "playing") return;
    const step = this.steps[this.idx];
    if (!step) return;
    if (step.kind === "silence") {
      this.skipFlag = true;
      this.advance(step.ms);
    }
  }

  pause(): void {
    if (this.state !== "playing") return;
    this.state = "paused";
    this.cbs.onState?.("paused");
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    // bank the partial elapsed within this step
    const within = Math.min(this.stepBudget, Date.now() - this.stepStart);
    this.elapsed = Math.min(this.total, this.elapsed + within);
    try {
      if (this.speechOK) window.speechSynthesis.cancel();
    } catch {
      /* noop */
    }
  }

  resume(): void {
    if (this.state !== "paused") return;
    this.state = "playing";
    this.cbs.onState?.("playing");
    this.startProgressTicker();
    // re-run the current step from its start (re-speak the line / re-time silence)
    this.runStep();
  }

  private finish(): void {
    this.cleanup();
    this.state = "done";
    this.elapsed = this.total;
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
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
    try {
      if (this.speechOK) window.speechSynthesis.cancel();
    } catch {
      /* noop */
    }
  }
}
