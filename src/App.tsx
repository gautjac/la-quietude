import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useLang } from "./i18n";
import { db, cacheKey, uid, localDay } from "./db";
import { generateSeance } from "./api";
import { loadVoices, pickDefaultVoice, hasSpeech, type Voice } from "./speech";
import { BedMixer } from "./audio";
import type {
  Dials,
  BedLevels,
  BedId,
  Seance,
  Preset,
  Favourite,
} from "./types";
import { Onboarding } from "./components/Onboarding";
import { Tuner } from "./components/Tuner";
import { BedPanel } from "./components/BedPanel";
import { VoicePanel } from "./components/VoicePanel";
import { Player } from "./components/Player";
import { Library } from "./components/Library";

const ONBOARDED = "quietude:onboarded";
const SETTINGS = "quietude:settings";

const DEFAULT_DIALS: Dials = { length: 5, theme: "stress", register: "plain", pacing: 0 };
const DEFAULT_BEDS: BedLevels = {
  rain: 0,
  drone: 0.4,
  piano: 0,
  ocean: 0,
  room: 0,
  forest: 0,
};

interface Persisted {
  dials: Dials;
  beds: BedLevels;
  master: number;
  voiceURI: string | null;
  rate: number;
  pitch: number;
}

function loadSettings(): Partial<Persisted> {
  try {
    const raw = localStorage.getItem(SETTINGS);
    return raw ? (JSON.parse(raw) as Partial<Persisted>) : {};
  } catch {
    return {};
  }
}

type Tab = "tune" | "library";

export default function App() {
  const { t, lang, setLang } = useLang();

  const saved = useMemo(loadSettings, []);
  const [onboard, setOnboard] = useState(false);
  const [tab, setTab] = useState<Tab>("tune");
  const [drawer, setDrawer] = useState<"sound" | "voice" | null>(null);

  const [dials, setDials] = useState<Dials>(saved.dials ?? DEFAULT_DIALS);
  const [beds, setBeds] = useState<BedLevels>(saved.beds ?? DEFAULT_BEDS);
  const [master, setMaster] = useState<number>(saved.master ?? 0.6);

  const [voices, setVoices] = useState<Voice[]>([]);
  const [voiceURI, setVoiceURI] = useState<string | null>(saved.voiceURI ?? null);
  const [rate, setRate] = useState<number>(saved.rate ?? 0.92);
  const [pitch, setPitch] = useState<number>(saved.pitch ?? 1.0);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<Seance | null>(null);
  const [activeFavId, setActiveFavId] = useState<string | null>(null);

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

  // ── voices ───────────────────────────────────────────────────────────────────
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
    const p: Persisted = { dials, beds, master, voiceURI, rate, pitch };
    try {
      localStorage.setItem(SETTINGS, JSON.stringify(p));
    } catch {
      /* noop */
    }
  }, [dials, beds, master, voiceURI, rate, pitch]);

  // ── live bed preview while on the sound drawer ────────────────────────────────
  useEffect(() => {
    if (drawer === "sound" && !active) {
      if (!previewMixer) {
        const m = new BedMixer(beds, master);
        setPreviewMixer(m);
        void m.ensure();
      }
    }
    // tear down preview when leaving the drawer or starting a session
    if ((drawer !== "sound" || active) && previewMixer) {
      void previewMixer.dispose();
      setPreviewMixer(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawer, active]);

  const setBed = (id: BedId, v: number) => {
    setBeds((b) => ({ ...b, [id]: v }));
    void previewMixer?.setBed(id, v);
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

  // ── generation ────────────────────────────────────────────────────────────────
  const begin = async (regenerate = false) => {
    setError(null);
    setGenerating(true);
    // stop preview audio cleanly before the player takes over
    if (previewMixer) {
      await previewMixer.dispose();
      setPreviewMixer(null);
    }
    try {
      const key = cacheKey(dials, lang, 0);
      if (!regenerate) {
        const cached = (await db.cache.get(key)) ?? null;
        if (cached) {
          setActiveFavId(null);
          setActive(cached.seance);
          setGenerating(false);
          return;
        }
      }
      const variant = regenerate ? Math.floor(Math.random() * 1000) + 1 : 0;
      const seance = await generateSeance({ dials, lang, variant });
      // cache the canonical (variant 0) version for instant repeat
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
      setActiveFavId(null);
      setActive(seance);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Une erreur est survenue.", "Something went wrong."));
    } finally {
      setGenerating(false);
    }
  };

  const playFavourite = (f: Favourite) => {
    setDials(f.dials);
    setActiveFavId(f.id);
    setActive({ title: f.title, intention: f.intention, lines: f.lines });
    setTab("tune");
  };

  const closePlayer = async (completedMs: number, plannedMs: number, completed: boolean) => {
    if (active) {
      await db.history.put({
        id: uid(),
        date: localDay(),
        at: Date.now(),
        theme: dials.theme,
        register: dials.register,
        length: dials.length,
        lang,
        completedMs,
        plannedMs,
        completed,
      });
    }
    setActive(null);
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
      lang,
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
              {t("méditation guidée, accordée à vous", "guided meditation, tuned to you")}
            </p>
          </div>
          <button
            onClick={() => setLang(lang === "fr" ? "en" : "fr")}
            className="tap rounded-full border border-bark/15 px-3 py-1.5 text-xs font-medium text-bark-soft transition hover:bg-linen-dim"
          >
            {lang === "fr" ? "EN" : "FR"}
          </button>
        </header>

        {/* tabs */}
        <div className="mb-7 flex gap-1 rounded-full bg-bark/5 p-1">
          <TabBtn on={tab === "tune"} onClick={() => setTab("tune")}>
            {t("Accorder", "Tune")}
          </TabBtn>
          <TabBtn on={tab === "library"} onClick={() => setTab("library")}>
            {t("Bibliothèque", "Library")}
          </TabBtn>
        </div>

        {tab === "tune" ? (
          <>
            <Tuner dials={dials} setDials={setDials} />

            {/* sound + voice openers */}
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
                <BedPanel beds={beds} master={master} onBed={setBed} onMaster={onMaster} />
              </div>
            )}
            {drawer === "voice" && (
              <div className="mt-4 rounded-3xl border border-bark/10 bg-linen-light/60 p-5 animate-riseIn">
                <VoicePanel
                  voices={voices}
                  voiceURI={voiceURI}
                  rate={rate}
                  pitch={pitch}
                  onVoice={setVoiceURI}
                  onRate={setRate}
                  onPitch={setPitch}
                  onPreview={previewVoice}
                />
              </div>
            )}

            {error && (
              <div className="mt-6 rounded-2xl bg-clay/12 px-4 py-3 text-sm text-bark-soft">
                <span className="font-medium">{t("Un pépin", "A snag")} — </span>
                {error}
              </div>
            )}

            {/* save preset */}
            <button
              onClick={savePreset}
              className="tap mt-7 w-full rounded-full border border-bark/12 py-2.5 text-sm font-medium text-bark-soft transition hover:bg-linen-dim active:scale-[0.99]"
            >
              ✶ {t("Garder ce réglage", "Save this setting")}
            </button>
          </>
        ) : (
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
      </div>

      {/* sticky begin bar (only on tune tab) */}
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
                : t("Commencer la séance", "Begin the session")}
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
