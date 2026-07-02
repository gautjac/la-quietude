import { useEffect, useRef, useState } from "react";
import { useLang } from "../i18n";
import { BedMixer } from "../audio";
import { registerStopper, pushActive, popActive } from "../audioBus";
import type { BedLevels } from "../types";

const DURATIONS = [5, 10, 15, 20, 30];
const INTERVALS = [
  { v: 0, fr: "Aucune", en: "None" },
  { v: 5, fr: "5 min", en: "5 min" },
  { v: 10, fr: "10 min", en: "10 min" },
];

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

/** An unguided sitting: a bell at the start, at each interval, and at the end,
 *  over an optional bed. No voice — for when you just want to sit. */
export function BellTimer({ beds, master }: { beds: BedLevels; master: number }) {
  const { t } = useLang();

  const [running, setRunning] = useState(false);
  const [durationMin, setDurationMin] = useState(10);
  const [intervalMin, setIntervalMin] = useState(0);
  const [withBed, setWithBed] = useState(false);
  const [remaining, setRemaining] = useState(0);

  const mixerRef = useRef<BedMixer | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const unregRef = useRef<(() => void) | null>(null);
  const endAtRef = useRef(0);

  const stop = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    timeoutsRef.current.forEach((tm) => clearTimeout(tm));
    timeoutsRef.current = [];
    void mixerRef.current?.dispose();
    mixerRef.current = null;
    if (unregRef.current) {
      unregRef.current();
      unregRef.current = null;
      popActive();
    }
    setRunning(false);
  };

  useEffect(() => () => stop(), []);

  const start = () => {
    const mixer = new BedMixer(withBed ? beds : ZERO_BEDS, master);
    mixerRef.current = mixer;
    pushActive();
    unregRef.current = registerStopper(() => stop());

    void mixer.ensure().then(() => {
      void mixer.chime(); // start bell
    });

    const durMs = durationMin * 60 * 1000;
    endAtRef.current = Date.now() + durMs;
    setRunning(true);
    setRemaining(durMs);

    // interval bells (not at 0, not at the very end)
    if (intervalMin > 0) {
      for (let k = 1; k * intervalMin < durationMin; k++) {
        timeoutsRef.current.push(
          setTimeout(() => void mixerRef.current?.chime(), k * intervalMin * 60 * 1000),
        );
      }
    }

    // end: a fuller two-ring close, then stop
    timeoutsRef.current.push(
      setTimeout(() => {
        void mixerRef.current?.chime();
        setTimeout(() => void mixerRef.current?.chime(), 2600);
        setTimeout(() => stop(), 5200);
      }, durMs),
    );

    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setRemaining(Math.max(0, endAtRef.current - Date.now()));
    }, 250);
  };

  const mmss = (ms: number) => {
    const s = Math.round(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  if (running) {
    return (
      <div className="flex flex-col items-center pt-2">
        <div className="relative my-8 flex h-72 w-72 items-center justify-center sm:h-80 sm:w-80">
          <div className="orb orb-anim h-full w-full" style={{ ["--breath" as string]: "12s" }} />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="font-display text-4xl tabular-nums text-bark">{mmss(remaining)}</span>
          </div>
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
          "Une assise sans guide : une cloche au début, à chaque intervalle, et à la fin. À vous le silence entre les deux.",
          "An unguided sitting: a bell at the start, at each interval, and at the end. The silence between is yours.",
        )}
      </p>

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

      <section>
        <Label>{t("Cloches d'intervalle", "Interval bells")}</Label>
        <div className="flex gap-2">
          {INTERVALS.map((iv) => {
            const on = intervalMin === iv.v;
            return (
              <button
                key={iv.v}
                onClick={() => setIntervalMin(iv.v)}
                className={`tap flex-1 rounded-full border py-2 text-[13px] font-medium transition active:scale-[0.97] ${
                  on
                    ? "border-clay bg-clay/15 text-bark"
                    : "border-bark/10 bg-linen-light/70 text-bark-soft hover:border-bark/20"
                }`}
              >
                {t(iv.fr, iv.en)}
              </button>
            );
          })}
        </div>
      </section>

      <button
        onClick={() => setWithBed((v) => !v)}
        className={`tap rounded-full border px-4 py-2 text-sm font-medium transition active:scale-[0.97] ${
          withBed
            ? "border-sage bg-sage/15 text-bark"
            : "border-bark/10 bg-linen-light/70 text-bark-soft hover:border-bark/20"
        }`}
      >
        {withBed ? "✓ " : ""}
        {t("Fond sonore", "Sound bed")}
      </button>

      <button
        onClick={start}
        className="tap w-full rounded-full bg-bark py-4 text-center text-[15px] font-medium text-linen-light shadow-soft transition hover:bg-bark-soft active:scale-[0.99]"
      >
        {t("Commencer l'assise", "Begin the sit")}
      </button>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-bark-faint">
      {children}
    </h3>
  );
}
