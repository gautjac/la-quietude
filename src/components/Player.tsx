import { useEffect, useRef, useState } from "react";
import { useLang } from "../i18n";
import {
  GuidancePlayer,
  BrowserSpeechEngine,
  ClipAudioEngine,
  type Voice,
  type PlayerLine,
  type VoiceEngine,
} from "../speech";
import type { Seance, Dials, BedLevels, Mood } from "../types";
import { BedMixer } from "../audio";
import { themeName, MOODS } from "../catalog";
import {
  setNowPlaying,
  setActionHandlers,
  setPlaybackState,
  setPosition,
  clearMediaSession,
  KeepAlive,
} from "../mediaSession";

/** When present, the player voices each line from a pre-rendered MP3 clip
 *  instead of the device's speech engine. */
export interface ClipSource {
  urls: (string | null)[];
  durationsMs: (number | null)[];
  voiceVolume: number; // 0..1
}

interface PlayerProps {
  seance: Seance;
  dials: Dials;
  voices: Voice[];
  voiceURI: string | null;
  rate: number;
  pitch: number;
  beds: BedLevels;
  master: number;
  clipSource?: ClipSource;
  /** Minutes to keep the bed going and fade after the voice ends (0 = off). */
  sleepTimerMin: number;
  onClose: (
    completedMs: number,
    plannedMs: number,
    completed: boolean,
    mood?: Mood,
    note?: string,
  ) => void;
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
    clipSource,
    sleepTimerMin,
    onClose,
    onToggleFavourite,
    isFavourite,
  } = props;

  const [state, setState] = useState<"playing" | "paused" | "stopped" | "done">("playing");
  const [line, setLine] = useState(seance.lines[0]?.text ?? "");
  const [elapsed, setElapsed] = useState(0);
  const [total, setTotal] = useState(1);
  const [inSilence, setInSilence] = useState(false);
  const [winding, setWinding] = useState(false); // bed fading on the sleep timer
  const [mood, setMood] = useState<Mood | null>(null);
  const [note, setNote] = useState("");

  const playerRef = useRef<GuidancePlayer | null>(null);
  const mixerRef = useRef<BedMixer | null>(null);
  const clipEngineRef = useRef<ClipAudioEngine | null>(null);
  const keepAliveRef = useRef<KeepAlive | null>(null);
  const reportedRef = useRef(false);

  // breathing cadence (seconds) scales a little with pacing — calmer = slower
  const breathSec = 9 + (2 - dials.pacing) * 0.8;

  // Imperative actions kept fresh for the lock-screen (Media Session) handlers,
  // which are registered once but must always drive the live player.
  const actionsRef = useRef({
    pause: () => {},
    resume: () => {},
    skip: () => {},
    stop: () => {},
  });

  useEffect(() => {
    const mixer = new BedMixer(beds, master);
    mixerRef.current = mixer;
    void mixer.ensure();

    const keepAlive = new KeepAlive();
    keepAliveRef.current = keepAlive;

    const wantLang = lang === "fr" ? "fr-CA" : "en-US";

    // Pre-rendered clips when available (catalogue séances); otherwise the
    // device's speech engine (live "device voice" mode).
    let engine: VoiceEngine;
    if (clipSource) {
      const clipEngine = new ClipAudioEngine(clipSource.urls, clipSource.voiceVolume);
      clipEngineRef.current = clipEngine;
      engine = clipEngine;
    } else {
      clipEngineRef.current = null;
      engine = new BrowserSpeechEngine({ voiceURI, rate, pitch, lang: wantLang }, voices);
    }

    const lines: PlayerLine[] = seance.lines.map((l, i) => ({
      text: l.text,
      pauseAfterMs: l.pauseAfterMs,
      knownMs: clipSource?.durationsMs[i] ?? undefined,
    }));

    const p = new GuidancePlayer(
      lines,
      engine,
      {
        onLine: (_i, text) => {
          setLine(text);
          setInSilence(false);
        },
        onSilence: () => setInSilence(true),
        onProgress: (e, tot) => {
          setElapsed(e);
          setTotal(tot);
          setPosition(tot, e);
        },
        onState: (st) => {
          setState(st);
          if (st === "playing") {
            keepAlive.start();
            setPlaybackState("playing");
          } else if (st === "paused") {
            keepAlive.pause();
            setPlaybackState("paused");
          } else if (st === "done" || st === "stopped") {
            // keep the silent track alive on the done/winding screen; it stops
            // on finish()/unmount. Reflect bed state on the lock screen.
            setPlaybackState(sleepTimerMin > 0 ? "playing" : "none");
          }
        },
        onDone: async () => {
          if (sleepTimerMin > 0) {
            setWinding(true);
            await mixer.fadeOut(sleepTimerMin * 60);
            setWinding(false);
          } else if (dials.theme === "sleep") {
            // sleep: dissolve the bed gently rather than ring a bell
            await mixer.fadeOut(10);
          } else {
            await mixer.chime();
          }
        },
      },
      rate,
    );
    playerRef.current = p;
    setTotal(p.totalMs);

    // Lock-screen / background controls
    setNowPlaying(seance.title, themeName(dials.theme, lang));
    setActionHandlers({
      play: () => actionsRef.current.resume(),
      pause: () => actionsRef.current.pause(),
      stop: () => actionsRef.current.stop(),
      skip: () => actionsRef.current.skip(),
    });

    p.start();

    return () => {
      p.stop();
      keepAlive.stop();
      clearMediaSession();
      void mixer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep the bed mix live if the parent changes the master
  useEffect(() => {
    mixerRef.current?.setMaster(master);
  }, [master]);

  // live voice-volume for clip playback
  useEffect(() => {
    if (clipSource) clipEngineRef.current?.setVolume(clipSource.voiceVolume);
  }, [clipSource?.voiceVolume, clipSource]);

  const pct = Math.min(100, (elapsed / Math.max(1, total)) * 100);

  const finish = (completed: boolean, withReflection = false) => {
    if (reportedRef.current) return;
    reportedRef.current = true;
    playerRef.current?.stop();
    keepAliveRef.current?.stop();
    onClose(
      elapsed,
      total,
      completed,
      withReflection ? mood ?? undefined : undefined,
      withReflection && note.trim() ? note.trim() : undefined,
    );
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

  // refresh the imperative actions every render so the lock-screen handlers act
  // on the current state
  actionsRef.current = {
    pause: () => playerRef.current?.pause(),
    resume: () => {
      playerRef.current?.resume();
      void mixerRef.current?.ensure();
    },
    skip: skipSilence,
    stop: () => finish(false),
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
            className={`orb h-full w-full ${state === "playing" || winding ? "orb-anim" : ""}`}
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

        {/* current line / closing */}
        <div className="min-h-[5.5rem] max-w-xl px-2 text-center">
          {winding ? (
            <p className="animate-fadeIn font-display text-2xl leading-snug text-bark">
              {t("Le fond s'estompe doucement. Bonne nuit.", "The bed fades gently. Good night.")}
            </p>
          ) : done ? (
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
          {done ? (
            winding ? (
              <button
                onClick={() => finish(true)}
                className="tap mx-auto block rounded-full border border-bark/15 px-8 py-3 text-sm font-medium text-bark-soft transition hover:bg-linen-dim active:scale-95"
              >
                {t("Terminer maintenant", "End now")}
              </button>
            ) : (
              <Reflection
                mood={mood}
                note={note}
                onMood={setMood}
                onNote={setNote}
                onFinish={() => finish(true, true)}
              />
            )
          ) : (
            <>
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
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Reflection({
  mood,
  note,
  onMood,
  onNote,
  onFinish,
}: {
  mood: Mood | null;
  note: string;
  onMood: (m: Mood) => void;
  onNote: (s: string) => void;
  onFinish: () => void;
}) {
  const { t, lang } = useLang();
  return (
    <div className="animate-riseIn">
      <p className="mb-3 text-center text-[12px] uppercase tracking-[0.16em] text-bark-faint">
        {t("Comment vous sentez-vous ?", "How do you feel?")}
      </p>
      <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
        {MOODS.map((m) => {
          const on = mood === m.id;
          return (
            <button
              key={m.id}
              onClick={() => onMood(m.id)}
              className={`tap flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-medium transition active:scale-95 ${
                on
                  ? "border-sage bg-sage/15 text-bark"
                  : "border-bark/12 bg-linen-light/70 text-bark-soft hover:border-bark/20"
              }`}
            >
              <span className="text-base text-sage-deep">{m.glyph}</span>
              {lang === "fr" ? m.fr : m.en}
            </button>
          );
        })}
      </div>
      <input
        value={note}
        onChange={(e) => onNote(e.target.value)}
        placeholder={t("Une note, si vous voulez…", "A note, if you like…")}
        maxLength={140}
        className="mb-4 w-full rounded-2xl border border-bark/12 bg-linen-light/80 px-4 py-2.5 text-sm text-bark transition focus:border-dawn focus:outline-none"
      />
      <button
        onClick={onFinish}
        className="tap w-full rounded-full bg-bark py-3.5 text-sm font-medium text-linen-light shadow-soft transition hover:bg-bark-soft active:scale-[0.99]"
      >
        {t("Terminer", "Finish")}
      </button>
    </div>
  );
}
