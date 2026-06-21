import { useEffect, useRef, useState } from "react";
import { useLang } from "../i18n";
import { GuidancePlayer, type Voice } from "../speech";
import type { Seance, Dials, BedLevels } from "../types";
import { BedMixer } from "../audio";
import { themeName } from "../catalog";

interface PlayerProps {
  seance: Seance;
  dials: Dials;
  voices: Voice[];
  voiceURI: string | null;
  rate: number;
  pitch: number;
  beds: BedLevels;
  master: number;
  onClose: (completedMs: number, plannedMs: number, completed: boolean) => void;
  onToggleFavourite: () => void;
  isFavourite: boolean;
}

function fmt(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function Player(props: PlayerProps) {
  const { t, lang } = useLang();
  const {
    seance,
    dials,
    voices,
    voiceURI,
    rate,
    pitch,
    beds,
    master,
    onClose,
    onToggleFavourite,
    isFavourite,
  } = props;

  const [state, setState] = useState<"playing" | "paused" | "stopped" | "done">("playing");
  const [line, setLine] = useState(seance.lines[0]?.text ?? "");
  const [elapsed, setElapsed] = useState(0);
  const [total, setTotal] = useState(1);
  const [inSilence, setInSilence] = useState(false);

  const playerRef = useRef<GuidancePlayer | null>(null);
  const mixerRef = useRef<BedMixer | null>(null);
  const reportedRef = useRef(false);

  // breathing cadence (seconds) scales a little with pacing — calmer = slower
  const breathSec = 9 + (2 - dials.pacing) * 0.8;

  useEffect(() => {
    const mixer = new BedMixer(beds, master);
    mixerRef.current = mixer;
    void mixer.ensure();

    const wantLang = lang === "fr" ? "fr-CA" : "en-US";
    const p = new GuidancePlayer(
      seance.lines,
      { voiceURI, rate, pitch, lang: wantLang },
      voices,
      {
        onLine: (_i, text) => {
          setLine(text);
          setInSilence(false);
        },
        onSilence: () => setInSilence(true),
        onProgress: (e, tot) => {
          setElapsed(e);
          setTotal(tot);
        },
        onState: (st) => setState(st),
        onDone: async () => {
          await mixer.chime();
        },
      },
    );
    playerRef.current = p;
    setTotal(p.totalMs);
    p.start();

    return () => {
      p.stop();
      void mixer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep the bed mix live if the user opened it from here (props are fixed here,
  // but we still react if parent changes them)
  useEffect(() => {
    mixerRef.current?.setMaster(master);
  }, [master]);

  const pct = Math.min(100, (elapsed / Math.max(1, total)) * 100);

  const finish = (completed: boolean) => {
    if (reportedRef.current) return;
    reportedRef.current = true;
    playerRef.current?.stop();
    onClose(elapsed, total, completed);
  };

  const togglePlay = () => {
    const p = playerRef.current;
    if (!p) return;
    if (state === "playing") {
      p.pause();
      void mixerRef.current?.ensure();
    } else if (state === "paused") {
      p.resume();
    }
  };

  const skipSilence = () => {
    playerRef.current?.skip();
    setInSilence(false);
  };

  const done = state === "done";

  return (
    <div className="grain fixed inset-0 z-40 flex flex-col bg-gradient-to-b from-linen-light via-linen to-sage/25">
      {/* top bar */}
      <div className="flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <button
          onClick={() => finish(done)}
          className="tap flex items-center gap-1.5 rounded-full bg-linen-light/60 px-3.5 py-2 text-sm font-medium text-bark-soft backdrop-blur transition hover:bg-linen-light active:scale-95"
        >
          ← {t("Quitter", "Leave")}
        </button>
        <div className="text-center">
          <div className="font-display text-lg leading-none text-bark">{seance.title}</div>
          <div className="mt-0.5 text-[11px] uppercase tracking-[0.16em] text-bark-faint">
            {themeName(dials.theme, lang)} · {dials.length} min
          </div>
        </div>
        <button
          onClick={onToggleFavourite}
          aria-label={t("Favori", "Favourite")}
          className={`tap flex h-9 w-9 items-center justify-center rounded-full backdrop-blur transition active:scale-90 ${
            isFavourite ? "bg-dawn/25 text-clay" : "bg-linen-light/60 text-bark-faint hover:text-clay"
          }`}
        >
          {isFavourite ? "♥" : "♡"}
        </button>
      </div>

      {/* orb */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-6">
        <div className="relative mb-10 flex h-64 w-64 items-center justify-center sm:h-72 sm:w-72">
          <div
            className={`orb h-full w-full ${state === "playing" ? "orb-anim" : ""}`}
            style={{ ["--breath" as string]: `${breathSec}s` }}
          />
          {!done && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="text-[13px] font-medium uppercase tracking-[0.2em] text-bark-soft/70">
                {state === "paused"
                  ? t("en pause", "paused")
                  : inSilence
                    ? t("respirez", "breathe")
                    : ""}
              </span>
            </div>
          )}
        </div>

        {/* current line */}
        <div className="min-h-[5.5rem] max-w-xl px-2 text-center">
          {done ? (
            <p className="animate-fadeIn font-display text-2xl leading-snug text-bark">
              {t("La séance est terminée. Restez un instant.", "The session is complete. Stay a moment.")}
            </p>
          ) : (
            <p
              key={line}
              className="animate-fadeIn font-display text-[1.7rem] leading-snug text-bark text-balance"
            >
              {line}
            </p>
          )}
        </div>
      </div>

      {/* controls */}
      <div className="px-6 pb-[calc(env(safe-area-inset-bottom)+1.75rem)]">
        <div className="mx-auto max-w-xl">
          {/* progress */}
          <div className="mb-2 flex items-center justify-between text-[12px] tabular-nums text-bark-faint">
            <span>{fmt(elapsed)}</span>
            <span>{fmt(total)}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-bark/12">
            <div
              className="h-full rounded-full bg-gradient-to-r from-dawn to-sage transition-[width] duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="mt-6 flex items-center justify-center gap-5">
            {done ? (
              <button
                onClick={() => finish(true)}
                className="tap rounded-full bg-bark px-8 py-3.5 text-sm font-medium text-linen-light shadow-soft transition hover:bg-bark-soft active:scale-95"
              >
                {t("Terminer", "Finish")}
              </button>
            ) : (
              <>
                <button
                  onClick={skipSilence}
                  className="tap flex h-12 w-12 items-center justify-center rounded-full bg-linen-light/70 text-bark-soft backdrop-blur transition hover:bg-linen-light active:scale-90"
                  aria-label={t("Passer le silence", "Skip silence")}
                  title={t("Passer le silence", "Skip silence")}
                >
                  ⤙
                </button>
                <button
                  onClick={togglePlay}
                  className="tap flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-bark text-2xl text-linen-light shadow-lift transition hover:bg-bark-soft active:scale-95"
                  aria-label={state === "playing" ? t("Pause", "Pause") : t("Reprendre", "Resume")}
                >
                  {state === "playing" ? "❚❚" : "▶"}
                </button>
                <button
                  onClick={() => finish(false)}
                  className="tap flex h-12 w-12 items-center justify-center rounded-full bg-linen-light/70 text-bark-soft backdrop-blur transition hover:bg-linen-light active:scale-90"
                  aria-label={t("Arrêter", "Stop")}
                  title={t("Arrêter", "Stop")}
                >
                  ■
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
