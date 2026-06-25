import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useLang } from "./i18n";
import { db, cacheKey, uid, localDay } from "./db";
import { generateSeance } from "./api";
import { loadCatalogue, loadSeanceMeta, clipUrl } from "./seances";
import { loadVoices, pickDefaultVoice, hasSpeech, type Voice } from "./speech";
import { BedMixer } from "./audio";
import type {
  Dials,
  BedLevels,
  BedId,
  Lang,
  Seance,
  Preset,
  Favourite,
  SeanceIndexEntry,
} from "./types";
import { Onboarding } from "./components/Onboarding";
import { Tuner } from "./components/Tuner";
import { BedPanel } from "./components/BedPanel";
import { VoicePanel } from "./components/VoicePanel";
import { Player, type ClipSource } from "./components/Player";
import { Library } from "./components/Library";
import { Catalogue } from "./components/Catalogue";
import { BreathPacer } from "./components/BreathPacer";
import { useTheme } from "./theme";
import {
  registerStopper,
  pushActive,
  popActive,
  stopAllSound,
  audioStore,
} from "./audioBus";
import type { Mood } from "./types";

const ONBOARDED = "quietude:onboarded";
const SETTINGS = "quietude:settings";

const DEFAULT_DIALS: Dials = { length: 5, theme: "stress", register: "plain", pacing: 0 };
const DEFAULT_BEDS: BedLevels = {
  rain: 0,
  ocean: 0,
  forest: 0,
  wind: 0,
  night: 0,
  fire: 0,
  drone: 0.3,
  hum: 0.12,
  bowls: 0,
  piano: 0,
  room: 0,
};

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

interface Persisted {
  dials: Dials;
  beds: BedLevels;
  master: number;
  voiceURI: string | null;
  rate: number;
  pitch: number;
  voiceVolume: number;
  sleepTimerMin: number;
  breathSync: boolean;
}

function loadSettings(): Partial<Persisted> {
  try {
    const raw = localStorage.getItem(SETTINGS);
    return raw ? (JSON.parse(raw) as Partial<Persisted>) : {};
  } catch {
    return {};
  }
}

type Tab = "seances" | "tune" | "breathe" | "library";

export default function App() {
  const { t, lang, setLang } = useLang();
  const { dark, toggle: toggleTheme } = useTheme();
  const audioActive = useSyncExternalStore(audioStore.subscribe, audioStore.getSnapshot);

  const saved = useMemo(loadSettings, []);
  const [onboard, setOnboard] = useState(false);
  const [tab, setTab] = useState<Tab>("seances");
  const [drawer, setDrawer] = useState<"sound" | "voice" | null>(null);

  const [dials, setDials] = useState<Dials>(saved.dials ?? DEFAULT_DIALS);
  // existing mixes keep their exact levels (new beds start at 0); brand-new
  // users get the curated default mix.
  const [beds, setBeds] = useState<BedLevels>(() =>
    saved.beds ? { ...ZERO_BEDS, ...saved.beds } : DEFAULT_BEDS,
  );
  const [master, setMaster] = useState<number>(saved.master ?? 0.6);

  const [voices, setVoices] = useState<Voice[]>([]);
  const [voiceURI, setVoiceURI] = useState<string | null>(saved.voiceURI ?? null);
  const [rate, setRate] = useState<number>(saved.rate ?? 0.92);
  const [pitch, setPitch] = useState<number>(saved.pitch ?? 1.0);
  const [voiceVolume, setVoiceVolume] = useState<number>(saved.voiceVolume ?? 0.9);
  const [sleepTimerMin, setSleepTimerMin] = useState<number>(saved.sleepTimerMin ?? 0);
  const [breathSync, setBreathSync] = useState<boolean>(saved.breathSync ?? false);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<Seance | null>(null);
  const [activeClip, setActiveClip] = useState<ClipSource | null>(null);
  const [activeLang, setActiveLang] = useState<Lang>(lang);
  const [activeSeanceId, setActiveSeanceId] = useState<string | null>(null);
  const [activeFavId, setActiveFavId] = useState<string | null>(null);

  // pre-rendered catalogue
  const [catalogue, setCatalogue] = useState<SeanceIndexEntry[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // a live preview mixer for the tuning screen (so beds are audible while you mix)
  const [previewMixer, setPreviewMixer] = useState<BedMixer | null>(null);

  // ── first run ──────────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      if (!localStorage.getItem(ONBOARDED)) setOnboard(true);
    } catch {
      /* noop */
    }
  }, []);

  const closeOnboarding = () => {
    setOnboard(false);
    try {
      localStorage.setItem(ONBOARDED, "1");
    } catch {
      /* noop */
    }
  };

  // ── catalogue ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    loadCatalogue().then((c) => {
      if (cancelled) return;
      setCatalogue(c);
      setCatLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── voices (device voice / live mode) ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    loadVoices().then((vs) => {
      if (cancelled) return;
      setVoices(vs);
      setVoiceURI((cur) => {
        if (cur && vs.some((v) => v.uri === cur)) return cur;
        return pickDefaultVoice(vs, lang);
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // when the language flips and no explicit voice chosen for it, re-pick
  useEffect(() => {
    if (voices.length === 0) return;
    const cur = voices.find((v) => v.uri === voiceURI);
    const matchesLang = cur?.lang.toLowerCase().startsWith(lang);
    if (!matchesLang) setVoiceURI(pickDefaultVoice(voices, lang));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // ── persist settings ─────────────────────────────────────────────────────────
  useEffect(() => {
    const p: Persisted = {
      dials,
      beds,
      master,
      voiceURI,
      rate,
      pitch,
      voiceVolume,
      sleepTimerMin,
      breathSync,
    };
    try {
      localStorage.setItem(SETTINGS, JSON.stringify(p));
    } catch {
      /* noop */
    }
  }, [dials, beds, master, voiceURI, rate, pitch, voiceVolume, sleepTimerMin, breathSync]);

  // ── live bed preview while on the sound drawer ────────────────────────────────
  useEffect(() => {
    if (drawer === "sound" && !active) {
      if (!previewMixer) {
        const m = new BedMixer(beds, master);
        setPreviewMixer(m);
        void m.ensure();
      }
    }
    if ((drawer !== "sound" || active) && previewMixer) {
      void previewMixer.dispose();
      setPreviewMixer(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawer, active]);

  // register the live bed preview with the global kill switch while it exists
  useEffect(() => {
    if (!previewMixer) return;
    pushActive();
    const unregister = registerStopper(() => {
      void previewMixer.dispose();
      setPreviewMixer(null);
      setDrawer(null);
    });
    return () => {
      unregister();
      popActive();
    };
  }, [previewMixer]);

  const setBed = (id: BedId, v: number) => {
    setBeds((b) => ({ ...b, [id]: v }));
    void previewMixer?.setBed(id, v);
  };
  const applyScene = (next: BedLevels) => {
    setBeds(next);
    if (previewMixer) {
      for (const id of Object.keys(next) as BedId[]) void previewMixer.setBed(id, next[id]);
    }
  };
  const onMaster = (v: number) => {
    setMaster(v);
    previewMixer?.setMaster(v);
  };

  const previewVoice = () => {
    if (!hasSpeech() || voiceURI === null) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(
        lang === "fr"
          ? "Respirez. Vous êtes ici, maintenant."
          : "Breathe. You are here, now.",
      );
      u.rate = rate;
      u.pitch = pitch;
      const v = window.speechSynthesis.getVoices().find((x) => x.voiceURI === voiceURI);
      if (v) {
        u.voice = v;
        u.lang = v.lang;
      }
      window.speechSynthesis.speak(u);
    } catch {
      /* noop */
    }
  };

  // ── Dexie live data ───────────────────────────────────────────────────────────
  const presets = useLiveQuery(() => db.presets.orderBy("createdAt").reverse().toArray(), []) ?? [];
  const history = useLiveQuery(() => db.history.orderBy("at").reverse().toArray(), []) ?? [];
  const favourites =
    useLiveQuery(() => db.favourites.orderBy("createdAt").reverse().toArray(), []) ?? [];

  const stopPreview = async () => {
    if (previewMixer) {
      await previewMixer.dispose();
      setPreviewMixer(null);
    }
  };

  // ── play a pre-rendered catalogue séance (real recorded voice) ────────────────
  const playFromCatalogue = async (id: string) => {
    setError(null);
    setBusyId(id);
    await stopPreview();
    try {
      const meta = await loadSeanceMeta(id);
      const urls = meta.lines.map((l) => clipUrl(id, l.clip));
      const durationsMs = meta.lines.map((l) => l.durationMs);
      setDials({
        length: meta.length,
        theme: meta.theme,
        register: meta.register,
        pacing: meta.pacing,
      });
      setActiveLang(meta.lang);
      setActiveSeanceId(meta.id);
      const fav = favourites.find((f) => f.seanceId === meta.id);
      setActiveFavId(fav?.id ?? null);
      setActive({
        title: meta.title,
        intention: meta.intention,
        lines: meta.lines.map((l) => ({ text: l.text, pauseAfterMs: l.pauseAfterMs })),
      });
      setActiveClip({ urls, durationsMs, voiceVolume });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t("Cette séance est introuvable.", "This séance could not be found."),
      );
    } finally {
      setBusyId(null);
    }
  };

  // ── generate + play a live séance (device voice) ──────────────────────────────
  const begin = async (regenerate = false) => {
    setError(null);
    setGenerating(true);
    await stopPreview();
    try {
      const key = cacheKey(dials, lang, 0);
      if (!regenerate) {
        const cached = (await db.cache.get(key)) ?? null;
        if (cached) {
          setActiveClip(null);
          setActiveSeanceId(null);
          setActiveLang(lang);
          setActiveFavId(null);
          setActive(cached.seance);
          setGenerating(false);
          return;
        }
      }
      const variant = regenerate ? Math.floor(Math.random() * 1000) + 1 : 0;
      const seance = await generateSeance({ dials, lang, variant });
      await db.cache.put({
        key,
        theme: dials.theme,
        length: dials.length,
        register: dials.register,
        pacing: dials.pacing,
        lang,
        seance,
        createdAt: Date.now(),
      });
      setActiveClip(null);
      setActiveSeanceId(null);
      setActiveLang(lang);
      setActiveFavId(null);
      setActive(seance);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Une erreur est survenue.", "Something went wrong."));
    } finally {
      setGenerating(false);
    }
  };

  const playFavourite = (f: Favourite) => {
    if (f.seanceId) {
      void playFromCatalogue(f.seanceId);
      return;
    }
    setActiveClip(null);
    setActiveSeanceId(null);
    setActiveLang(f.lang);
    setDials(f.dials);
    setActiveFavId(f.id);
    setActive({ title: f.title, intention: f.intention, lines: f.lines });
  };

  const closePlayer = async (
    completedMs: number,
    plannedMs: number,
    completed: boolean,
    mood?: Mood,
    note?: string,
  ) => {
    if (active) {
      await db.history.put({
        id: uid(),
        date: localDay(),
        at: Date.now(),
        theme: dials.theme,
        register: dials.register,
        length: dials.length,
        lang: activeLang,
        completedMs,
        plannedMs,
        completed,
        mood,
        note,
      });
    }
    setActive(null);
    setActiveClip(null);
    setActiveSeanceId(null);
    setActiveFavId(null);
  };

  const toggleFavourite = async () => {
    if (!active) return;
    if (activeFavId) {
      await db.favourites.delete(activeFavId);
      setActiveFavId(null);
      return;
    }
    const id = uid();
    await db.favourites.put({
      id,
      title: active.title,
      intention: active.intention,
      dials,
      lines: active.lines,
      lang: activeLang,
      seanceId: activeSeanceId ?? undefined,
      createdAt: Date.now(),
    });
    setActiveFavId(id);
  };

  const savePreset = async () => {
    const name = window.prompt(
      t("Nom du réglage", "Preset name"),
      t("Mon réglage", "My preset"),
    );
    if (!name) return;
    const p: Preset = {
      id: uid(),
      name: name.trim(),
      dials,
      beds,
      master,
      voiceURI,
      rate,
      pitch,
      createdAt: Date.now(),
    };
    await db.presets.put(p);
  };

  const loadPreset = (p: Preset) => {
    setDials(p.dials);
    setBeds(p.beds);
    setMaster(p.master);
    if (p.voiceURI && voices.some((v) => v.uri === p.voiceURI)) setVoiceURI(p.voiceURI);
    setRate(p.rate);
    setPitch(p.pitch);
    setTab("tune");
  };

  // ── render ────────────────────────────────────────────────────────────────────
  return (
    <div className="grain min-h-full">
      {onboard && <Onboarding onClose={closeOnboarding} />}

      {active && (
        <Player
          seance={active}
          dials={dials}
          voices={voices}
          voiceURI={voiceURI}
          rate={rate}
          pitch={pitch}
          beds={beds}
          master={master}
          clipSource={activeClip ?? undefined}
          sleepTimerMin={sleepTimerMin}
          breathSync={breathSync}
          onClose={closePlayer}
          onToggleFavourite={toggleFavourite}
          isFavourite={!!activeFavId}
        />
      )}

      <div className="relative z-10 mx-auto max-w-2xl px-5 pb-32 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
        {/* header */}
        <header className="mb-7 flex items-center justify-between">
          <div>
            <h1 className="font-display text-4xl leading-none text-bark">La Quiétude</h1>
            <p className="mt-1.5 text-[13px] text-bark-faint">
              {t("méditation guidée, à voix réelle", "guided meditation, in a real voice")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {audioActive && (
              <button
                onClick={() => stopAllSound()}
                aria-label={t("Couper le son", "Stop all sound")}
                title={t("Couper le son", "Stop all sound")}
                className="tap flex items-center gap-1.5 rounded-full border border-clay/40 bg-clay/12 px-3 py-1.5 text-xs font-medium text-clay transition hover:bg-clay/20 active:scale-95"
              >
                <span aria-hidden>◼</span>
                {t("Couper le son", "Stop sound")}
              </button>
            )}
            <button
              onClick={toggleTheme}
              aria-label={dark ? t("Mode clair", "Light mode") : t("Mode sombre", "Dark mode")}
              title={dark ? t("Mode clair", "Light mode") : t("Mode sombre", "Dark mode")}
              className="tap flex h-8 w-8 items-center justify-center rounded-full border border-bark/15 text-bark-soft transition hover:bg-linen-dim"
            >
              {dark ? "☀" : "☾"}
            </button>
            <button
              onClick={() => setLang(lang === "fr" ? "en" : "fr")}
              className="tap rounded-full border border-bark/15 px-3 py-1.5 text-xs font-medium text-bark-soft transition hover:bg-linen-dim"
            >
              {lang === "fr" ? "EN" : "FR"}
            </button>
          </div>
        </header>

        {/* tabs */}
        <div className="mb-7 flex gap-1 rounded-full bg-bark/5 p-1">
          <TabBtn on={tab === "seances"} onClick={() => setTab("seances")}>
            {t("Séances", "Séances")}
          </TabBtn>
          <TabBtn on={tab === "tune"} onClick={() => setTab("tune")}>
            {t("Accorder", "Tune")}
          </TabBtn>
          <TabBtn on={tab === "breathe"} onClick={() => setTab("breathe")}>
            {t("Respirer", "Breathe")}
          </TabBtn>
          <TabBtn on={tab === "library"} onClick={() => setTab("library")}>
            {t("Bibliothèque", "Library")}
          </TabBtn>
        </div>

        {tab === "seances" && (
          <Catalogue
            entries={catalogue}
            loading={catLoading}
            busyId={busyId}
            onPlay={playFromCatalogue}
          />
        )}

        {tab === "tune" && (
          <>
            <div className="mb-6 rounded-2xl border border-bark/10 bg-linen-light/50 px-4 py-3 text-[13px] leading-snug text-bark-soft">
              {t(
                "Mode libre : composez n'importe quelle séance et faites-la dire par la voix de votre appareil. Pour la voix studio, voyez l'onglet Séances.",
                "Free mode: compose any séance and have it spoken by your device's voice. For the studio voice, see the Séances tab.",
              )}
            </div>
            <Tuner dials={dials} setDials={setDials} />
          </>
        )}

        {tab === "breathe" && <BreathPacer beds={beds} master={master} />}

        {tab === "library" && (
          <Library
            presets={presets}
            history={history}
            favourites={favourites}
            onLoadPreset={loadPreset}
            onDeletePreset={(id) => db.presets.delete(id)}
            onPlayFavourite={playFavourite}
            onDeleteFavourite={(id) => db.favourites.delete(id)}
          />
        )}

        {/* shared sound + voice controls (séances + tune) */}
        {(tab === "seances" || tab === "tune") && (
          <>
            <div className="mt-8 grid grid-cols-2 gap-2.5">
              <OpenerBtn onClick={() => setDrawer(drawer === "sound" ? null : "sound")} on={drawer === "sound"}>
                ≈ {t("Fond sonore", "Sound bed")}
              </OpenerBtn>
              <OpenerBtn onClick={() => setDrawer(drawer === "voice" ? null : "voice")} on={drawer === "voice"}>
                ♪ {t("La voix", "The voice")}
              </OpenerBtn>
            </div>

            {drawer === "sound" && (
              <div className="mt-4 rounded-3xl border border-bark/10 bg-linen-light/60 p-5 animate-riseIn">
                <BedPanel
                  beds={beds}
                  master={master}
                  onBed={setBed}
                  onMaster={onMaster}
                  sleepTimerMin={sleepTimerMin}
                  onSleepTimer={setSleepTimerMin}
                  breathSync={breathSync}
                  onBreathSync={setBreathSync}
                  onScene={(b) => applyScene({ ...ZERO_BEDS, ...b })}
                />
              </div>
            )}
            {drawer === "voice" && (
              <div className="mt-4 rounded-3xl border border-bark/10 bg-linen-light/60 p-5 animate-riseIn">
                <VoicePanel
                  voices={voices}
                  voiceURI={voiceURI}
                  rate={rate}
                  pitch={pitch}
                  voiceVolume={voiceVolume}
                  onVoice={setVoiceURI}
                  onRate={setRate}
                  onPitch={setPitch}
                  onVoiceVolume={setVoiceVolume}
                  onPreview={previewVoice}
                  showDeviceControls={tab === "tune"}
                />
              </div>
            )}
          </>
        )}

        {error && (
          <div className="mt-6 rounded-2xl bg-clay/12 px-4 py-3 text-sm text-bark-soft">
            <span className="font-medium">{t("Un pépin", "A snag")} — </span>
            {error}
          </div>
        )}

        {tab === "tune" && (
          <button
            onClick={savePreset}
            className="tap mt-7 w-full rounded-full border border-bark/12 py-2.5 text-sm font-medium text-bark-soft transition hover:bg-linen-dim active:scale-[0.99]"
          >
            ✶ {t("Garder ce réglage", "Save this setting")}
          </button>
        )}
      </div>

      {/* sticky begin bar (only on the live tune tab) */}
      {tab === "tune" && !active && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-bark/10 bg-linen-light/85 px-5 pb-[calc(env(safe-area-inset-bottom)+0.9rem)] pt-3 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <button
              onClick={() => begin(false)}
              disabled={generating}
              className="tap flex-1 rounded-full bg-bark py-4 text-center text-[15px] font-medium text-linen-light shadow-soft transition hover:bg-bark-soft active:scale-[0.99] disabled:opacity-60"
            >
              {generating
                ? t("On prépare la séance…", "Preparing the session…")
                : t("Commencer (voix de l'appareil)", "Begin (device voice)")}
            </button>
            <button
              onClick={() => begin(true)}
              disabled={generating}
              title={t("Régénérer un script", "Regenerate a script")}
              className="tap flex h-[3.4rem] w-[3.4rem] shrink-0 items-center justify-center rounded-full border border-bark/15 text-bark-soft transition hover:bg-linen-dim active:scale-95 disabled:opacity-50"
            >
              {generating ? <span className="animate-glow">◴</span> : "↻"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TabBtn({
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
      className={`tap flex-1 rounded-full py-2 text-sm font-medium transition ${
        on ? "bg-linen-light text-bark shadow-soft" : "text-bark-faint hover:text-bark-soft"
      }`}
    >
      {children}
    </button>
  );
}

function OpenerBtn({
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
      className={`tap rounded-2xl border py-3 text-sm font-medium transition active:scale-[0.98] ${
        on
          ? "border-sage bg-sage/12 text-bark"
          : "border-bark/10 bg-linen-light/70 text-bark-soft hover:border-bark/20"
      }`}
    >
      {children}
    </button>
  );
}
