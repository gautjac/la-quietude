import { useEffect, useRef, useState } from "react";
import { useLang } from "../i18n";
import { BREATH_PATTERNS, type BreathPattern, type BreathPhase } from "../catalog";
import { BedMixer } from "../audio";
import type { BedLevels } from "../types";

const DURATIONS = [1, 2, 3, 5, 10];

function phaseLabel(kind: BreathPhase["kind"], lang: "fr" | "en"): string {
  const map = {
    in: ["Inspirez", "Breathe in"],
    hold: ["Retenez", "Hold"],
    out: ["Expirez", "Breathe out"],
    rest: ["Pause", "Rest"],
  } as const;
  return lang === "fr" ? map[kind][0] : map[kind][1];
}

function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* noop */
  }
}

/** A standalone guided-breathing tool: choose a pattern and a length, then
 *  follow the orb. The bed and a soft breath cue are optional; haptics fire on
 *  each inhale/exhale where supported. */
export function BreathPacer({ beds, master }: { beds: BedLevels; master: number }) {
  const { t, lang } = useLang();

  const [running, setRunning] = useState(false);
  const [patternId, setPatternId] = useState("coherence");
  const [durationMin, setDurationMin] = useState(3);
  const [withBed, setWithBed] = useState(false);
  const [withCue, setWithCue] = useState(true);

  // live run state
  const [phaseKind, setPhaseKind] = useState<BreathPhase["kind"]>("in");
  const [phaseSec, setPhaseSec] = useState(1);
  const [scale, setScale] = useState(0.62);
  const [remaining, setRemaining] = useState(0);

  const pattern: BreathPattern =
    BREATH_PATTERNS.find((p) => p.id === patternId) ?? BREATH_PATTERNS[0];

  const mixerRef = useRef<BedMixer | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endAtRef = useRef(0);

  const stop = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    timerRef.current = null;
    tickRef.current = null;
    void mixerRef.current?.dispose();
    mixerRef.current = null;
    setRunning(false);
  };

  // tear down on unmount
  useEffect(() => () => stop(), []);

  const start = () => {
    const mixer = new BedMixer(withBed ? beds : ZERO_BEDS, master);
    mixerRef.current = mixer;
    const cycleSec = pattern.phases.reduce((s, p) => s + p.sec, 0);
    void mixer.ensure().then(() => {
      if (withBed) mixer.setBreath(cycleSec);
    });

    endAtRef.current = Date.now() + durationMin * 60 * 1000;
    setRunning(true);
    setRemaining(durationMin * 60 * 1000);

    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setRemaining(Math.max(0, endAtRef.current - Date.now()));
    }, 250);

    let i = 0;
    const runPhase = () => {
      if (Date.now() >= endAtRef.current) {
        void mixer.chime();
        stop();
        return;
      }
      const ph = pattern.phases[i % pattern.phases.length];
      setPhaseKind(ph.kind);
      setPhaseSec(ph.sec);
      // orb target: full on inhale/hold-after-in, small on exhale/rest
      setScale(ph.kind === "in" || ph.kind === "hold" ? 1.0 : 0.62);
      if (ph.kind === "in") {
        if (withCue) void mixer.cue("in");
        vibrate(40);
      } else if (ph.kind === "out") {
        if (withCue) void mixer.cue("out");
        vibrate([0, 30, 30, 30]);
      }
      i += 1;
      timerRef.current = setTimeout(runPhase, ph.sec * 1000);
    };
    // begin from a settled small orb
    setScale(0.62);
    runPhase();
  };

  const mmss = (ms: number) => {
    const s = Math.round(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  if (running) {
    return (
      <div className="flex flex-col items-center pt-2">
        <div className="relative my-8 flex h-72 w-72 items-center justify-center sm:h-80 sm:w-80">
          <div
            className="orb h-full w-full"
            style={{
              transform: `scale(${scale})`,
              transition: `transform ${phaseSec}s cubic-bezier(0.37, 0, 0.63, 1)`,
            }}
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="font-display text-2xl text-bark">{phaseLabel(phaseKind, lang)}</span>
          </div>
        </div>

        <div className="mb-7 text-center">
          <div className="font-display text-lg text-bark">
            {lang === "fr" ? pattern.fr : pattern.en}
          </div>
          <div className="mt-0.5 text-[12px] tabular-nums text-bark-faint">{mmss(remaining)}</div>
        </div>

        <button
          onClick={stop}
          className="tap rounded-full border border-bark/15 px-8 py-3 text-sm font-medium text-bark-soft transition hover:bg-linen-dim active:scale-95"
        >
          {t("Terminer", "Finish")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <p className="text-[13px] leading-snug text-bark-soft">
        {t(
          "Une respiration guidée, sans paroles. Suivez la sphère : elle gonfle quand vous inspirez, se rétracte quand vous expirez.",
          "A wordless guided breath. Follow the orb: it swells as you inhale, settles as you exhale.",
        )}
      </p>

      {/* pattern */}
      <section>
        <Label>{t("Rythme", "Pattern")}</Label>
        <div className="grid grid-cols-2 gap-2.5">
          {BREATH_PATTERNS.map((p) => {
            const on = patternId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setPatternId(p.id)}
                className={`tap rounded-2xl border p-3.5 text-left transition active:scale-[0.98] ${
                  on
                    ? "border-sage bg-sage/12 shadow-soft"
                    : "border-bark/10 bg-linen-light/70 hover:border-bark/20"
                }`}
              >
                <div className="font-display text-lg leading-tight text-bark">
                  {lang === "fr" ? p.fr : p.en}
                </div>
                <div className="mt-1 text-[11px] leading-snug text-bark-faint">
                  {lang === "fr" ? p.noteFr : p.noteEn}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* duration */}
      <section>
        <Label>{t("Durée", "Length")}</Label>
        <div className="grid grid-cols-5 gap-2">
          {DURATIONS.map((m) => {
            const on = durationMin === m;
            return (
              <button
                key={m}
                onClick={() => setDurationMin(m)}
                className={`tap rounded-2xl border py-3 text-center transition active:scale-[0.97] ${
                  on
                    ? "border-dawn bg-dawn/15 shadow-soft"
                    : "border-bark/10 bg-linen-light/70 hover:border-bark/20"
                }`}
              >
                <div className="font-display text-2xl leading-none text-bark">{m}</div>
                <div className="mt-0.5 text-[10px] uppercase tracking-wide text-bark-faint">min</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* options */}
      <div className="flex flex-wrap gap-2.5">
        <Toggle on={withCue} onClick={() => setWithCue((v) => !v)}>
          {t("Carillon doux", "Soft cue")}
        </Toggle>
        <Toggle on={withBed} onClick={() => setWithBed((v) => !v)}>
          {t("Fond sonore", "Sound bed")}
        </Toggle>
      </div>

      <button
        onClick={start}
        className="tap w-full rounded-full bg-bark py-4 text-center text-[15px] font-medium text-linen-light shadow-soft transition hover:bg-bark-soft active:scale-[0.99]"
      >
        {t("Commencer à respirer", "Begin breathing")}
      </button>
    </div>
  );
}

const ZERO_BEDS: BedLevels = {
  rain: 0,
  ocean: 0,
  forest: 0,
  wind: 0,
  night: 0,
  fire: 0,
  drone: 0,
  hum: 0,
  bowls: 0,
  piano: 0,
  room: 0,
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-bark-faint">
      {children}
    </h3>
  );
}

function Toggle({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`tap rounded-full border px-4 py-2 text-sm font-medium transition active:scale-[0.97] ${
        on
          ? "border-sage bg-sage/15 text-bark"
          : "border-bark/10 bg-linen-light/70 text-bark-soft hover:border-bark/20"
      }`}
    >
      {on ? "✓ " : ""}
      {children}
    </button>
  );
}
