import { useState } from "react";
import { useLang } from "../i18n";
import { themeName, registerName, moodDef } from "../catalog";
import type { Preset, HistoryEntry, Favourite } from "../types";
import { computeStreak } from "../db";
import { downloadAllForOffline, isDownloaded } from "../offline";
import { reflections, buildRecueilMarkdown, exportRecueil } from "../recueil";

export function Library({
  presets,
  history,
  favourites,
  onLoadPreset,
  onDeletePreset,
  onPlayFavourite,
  onDeleteFavourite,
}: {
  presets: Preset[];
  history: HistoryEntry[];
  favourites: Favourite[];
  onLoadPreset: (p: Preset) => void;
  onDeletePreset: (id: string) => void;
  onPlayFavourite: (f: Favourite) => void;
  onDeleteFavourite: (id: string) => void;
}) {
  const { t, lang } = useLang();

  const days = new Set(history.map((h) => h.date));
  const streak = computeStreak(days);
  const totalMin = Math.round(history.reduce((s, h) => s + h.completedMs, 0) / 60000);
  const sits = history.length;

  return (
    <div className="space-y-10">
      {/* gentle streak */}
      <section className="rounded-3xl bg-gradient-to-br from-dawn/15 to-sage/12 p-6 shadow-soft">
        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat value={String(streak)} label={t("jours de suite", "days in a row")} />
          <Stat value={String(sits)} label={t("séances", "sittings")} />
          <Stat value={String(totalMin)} label={t("minutes", "minutes")} />
        </div>
        <p className="mt-4 text-center text-[13px] italic leading-snug text-bark-soft">
          {streak > 0
            ? t(
                "Une présence régulière, à votre rythme. Un jour manqué n'efface rien.",
                "A steady presence, at your pace. A missed day erases nothing.",
              )
            : t(
                "Asseyez-vous quand vous le pouvez. Rien ne se perd ici.",
                "Sit when you can. Nothing is lost here.",
              )}
        </p>
      </section>

      {/* recueil — reflections */}
      <RecueilSection history={history} />

      {/* offline */}
      <OfflineSection />

      {/* favourites */}
      <Section title={t("Favoris", "Favourites")}>
        {favourites.length === 0 ? (
          <Empty>
            {t(
              "Gardez une séance qui vous a touché — vous la rejouerez à l'identique.",
              "Keep a session that moved you — you'll replay it exactly.",
            )}
          </Empty>
        ) : (
          <div className="space-y-2.5">
            {favourites.map((f) => (
              <div
                key={f.id}
                className="group flex items-center gap-3 rounded-2xl border border-bark/10 bg-linen-light/70 p-4"
              >
                <button
                  onClick={() => onPlayFavourite(f)}
                  className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-dawn/20 text-clay transition hover:bg-dawn/30 active:scale-90"
                  aria-label={t("Jouer", "Play")}
                >
                  ▶
                </button>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-lg text-bark">{f.title}</div>
                  <div className="text-[12px] text-bark-faint">
                    {themeName(f.dials.theme, lang)} · {f.dials.length} min ·{" "}
                    {registerName(f.dials.register, lang)}
                  </div>
                </div>
                <button
                  onClick={() => onDeleteFavourite(f.id)}
                  className="tap text-bark-faint opacity-0 transition group-hover:opacity-100 hover:text-clay"
                  aria-label={t("Retirer", "Remove")}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* presets */}
      <Section title={t("Réglages gardés", "Saved presets")}>
        {presets.length === 0 ? (
          <Empty>
            {t(
              "Enregistrez vos cadrans préférés pour les retrouver d'un geste.",
              "Save your favourite dial settings to recall them in one tap.",
            )}
          </Empty>
        ) : (
          <div className="space-y-2.5">
            {presets.map((p) => (
              <div
                key={p.id}
                className="group flex items-center gap-3 rounded-2xl border border-bark/10 bg-linen-light/70 p-4"
              >
                <button
                  onClick={() => onLoadPreset(p)}
                  className="tap min-w-0 flex-1 text-left"
                >
                  <div className="truncate font-display text-lg text-bark">{p.name}</div>
                  <div className="text-[12px] text-bark-faint">
                    {themeName(p.dials.theme, lang)} · {p.dials.length} min ·{" "}
                    {registerName(p.dials.register, lang)}
                  </div>
                </button>
                <button
                  onClick={() => onDeletePreset(p.id)}
                  className="tap text-bark-faint opacity-0 transition group-hover:opacity-100 hover:text-clay"
                  aria-label={t("Supprimer", "Delete")}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* history */}
      <Section title={t("Historique", "History")}>
        {history.length === 0 ? (
          <Empty>{t("Vos séances passées apparaîtront ici.", "Your past sittings will appear here.")}</Empty>
        ) : (
          <div className="space-y-1.5">
            {history.slice(0, 30).map((h) => {
              const mood = h.mood ? moodDef(h.mood) : undefined;
              return (
                <div
                  key={h.id}
                  className="rounded-xl px-3.5 py-2.5 text-sm odd:bg-linen-light/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-bark-soft">
                      {themeName(h.theme, lang)}
                      <span className="text-bark-faint"> · {h.length} min</span>
                    </span>
                    <span className="flex items-center gap-2 text-[12px] text-bark-faint">
                      {mood && (
                        <span className="flex items-center gap-1 text-sage-deep">
                          <span className="text-sm">{mood.glyph}</span>
                          {lang === "fr" ? mood.fr : mood.en}
                        </span>
                      )}
                      {h.completed && <span className="text-sage-deep">✓</span>}
                      {new Date(h.at).toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  {h.note && (
                    <p className="mt-1 text-[12px] italic leading-snug text-bark-faint">
                      “{h.note}”
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-display text-4xl leading-none text-bark">{value}</div>
      <div className="mt-1.5 text-[11px] uppercase tracking-wide text-bark-faint">{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-bark-faint">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-bark/15 px-4 py-5 text-center text-[13px] leading-snug text-bark-faint">
      {children}
    </p>
  );
}

function RecueilSection({ history }: { history: HistoryEntry[] }) {
  const { t, lang } = useLang();
  const items = reflections(history);

  const doExport = () => {
    void exportRecueil(buildRecueilMarkdown(history, lang));
  };

  return (
    <Section title={t("Recueil", "Recueil")}>
      {items.length === 0 ? (
        <Empty>
          {t(
            "Après une séance, notez comment vous vous sentez — vos réflexions se rassembleront ici.",
            "After a sitting, note how you feel — your reflections gather here.",
          )}
        </Empty>
      ) : (
        <>
          <div className="space-y-2.5">
            {items.slice(0, 40).map((h) => {
              const mood = h.mood ? moodDef(h.mood) : undefined;
              return (
                <div
                  key={h.id}
                  className="rounded-2xl border border-bark/10 bg-linen-light/70 p-4"
                >
                  <div className="mb-1 flex items-center justify-between text-[12px] text-bark-faint">
                    <span>
                      {themeName(h.theme, lang)} · {h.length} min
                    </span>
                    <span className="flex items-center gap-2">
                      {mood && (
                        <span className="flex items-center gap-1 text-sage-deep">
                          <span className="text-sm">{mood.glyph}</span>
                          {lang === "fr" ? mood.fr : mood.en}
                        </span>
                      )}
                      {new Date(h.at).toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  {h.note && h.note.trim() && (
                    <p className="font-display text-lg leading-snug text-bark">
                      « {h.note.trim()} »
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <button
            onClick={doExport}
            className="tap mt-4 w-full rounded-full border border-bark/12 py-2.5 text-sm font-medium text-bark-soft transition hover:bg-linen-dim active:scale-[0.99]"
          >
            ↧ {t("Exporter le recueil (Markdown)", "Export the recueil (Markdown)")}
          </button>
        </>
      )}
    </Section>
  );
}

function OfflineSection() {
  const { t } = useLang();
  const [done, setDone] = useState(isDownloaded());
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setProgress({ done: 0, total: 0 });
    try {
      await downloadAllForOffline((d, total) => setProgress({ done: d, total }));
      setDone(true);
    } catch {
      /* leave state; the user can retry */
    } finally {
      setBusy(false);
    }
  };

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Section title={t("Hors-ligne", "Offline")}>
      <div className="rounded-2xl border border-bark/10 bg-linen-light/70 p-4">
        <p className="text-[13px] leading-snug text-bark-soft">
          {t(
            "Installez La Quiétude sur votre écran d'accueil et téléchargez les séances pour les écouter sans réseau — au chevet, en avion, dans un coin sans signal.",
            "Install La Quiétude to your home screen and download the séances to listen with no network — at the bedside, on a plane, in a dead zone.",
          )}
        </p>

        {busy ? (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[12px] tabular-nums text-bark-faint">
              <span>{t("Téléchargement…", "Downloading…")}</span>
              <span>
                {progress.done}/{progress.total || "…"}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-bark/12">
              <div
                className="h-full rounded-full bg-gradient-to-r from-dawn to-sage transition-[width] duration-200"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ) : (
          <button
            onClick={run}
            className={`tap mt-4 w-full rounded-full py-2.5 text-sm font-medium transition active:scale-[0.99] ${
              done
                ? "border border-sage bg-sage/12 text-bark"
                : "bg-bark text-linen-light shadow-soft hover:bg-bark-soft"
            }`}
          >
            {done
              ? t("✓ Disponible hors-ligne · re-télécharger", "✓ Available offline · re-download")
              : t("Télécharger les séances (~31 Mo)", "Download the séances (~31 MB)")}
          </button>
        )}
      </div>
    </Section>
  );
}
