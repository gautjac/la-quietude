import { useMemo, useState } from "react";
import { useLang } from "../i18n";
import { THEMES, registerName } from "../catalog";
import type { SeanceIndexEntry, ThemeId } from "../types";

function fmtMin(ms: number): string {
  return String(Math.max(1, Math.round(ms / 60000)));
}

/** A short, human voice label from an Edge-TTS voice id, e.g.
 *  "fr-CA-SylvieNeural" → "Sylvie · fr-CA". */
function voiceLabel(voice: string): string {
  const m = voice.match(/^([a-z]{2}-[A-Z]{2})-([A-Za-z]+?)(Multilingual)?Neural$/);
  if (!m) return voice;
  return `${m[2]} · ${m[1]}`;
}

export function Catalogue({
  entries,
  loading,
  busyId,
  onPlay,
}: {
  entries: SeanceIndexEntry[];
  loading: boolean;
  busyId: string | null;
  onPlay: (id: string) => void;
}) {
  const { t, lang } = useLang();
  const [onlyLang, setOnlyLang] = useState(true);

  const shown = useMemo(
    () => (onlyLang ? entries.filter((e) => e.lang === lang) : entries),
    [entries, onlyLang, lang],
  );

  // group by theme, preserving the THEMES order
  const byTheme = useMemo(() => {
    const map = new Map<ThemeId, SeanceIndexEntry[]>();
    for (const th of THEMES) {
      const list = shown.filter((e) => e.theme === th.id);
      if (list.length) map.set(th.id, list);
    }
    return map;
  }, [shown]);

  if (loading) {
    return (
      <p className="rounded-2xl border border-dashed border-bark/15 px-4 py-8 text-center text-sm text-bark-faint">
        {t("On ouvre la bibliothèque des voix…", "Opening the voice library…")}
      </p>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-bark/15 px-4 py-8 text-center text-[13px] leading-snug text-bark-faint">
        {t(
          "Aucune séance pré-enregistrée pour l'instant. Lancez « npm run render:seances » pour les générer.",
          "No pre-recorded séances yet. Run “npm run render:seances” to generate them.",
        )}
      </p>
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <p className="text-[13px] leading-snug text-bark-soft">
          {t(
            "Des séances enregistrées avec une vraie voix neuronale.",
            "Sittings recorded with a real neural voice.",
          )}
        </p>
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] text-bark-faint">
          <input
            type="checkbox"
            checked={onlyLang}
            onChange={(e) => setOnlyLang(e.target.checked)}
            className="accent-dawn"
          />
          {lang === "fr" ? "en français" : "in English"}
        </label>
      </div>

      <div className="space-y-8">
        {[...byTheme.entries()].map(([themeId, list]) => {
          const th = THEMES.find((x) => x.id === themeId)!;
          return (
            <section key={themeId}>
              <div className="mb-3 flex items-center gap-2">
                <span className="text-lg text-sage-deep">{th.glyph}</span>
                <h3 className="font-display text-xl text-bark">
                  {lang === "fr" ? th.fr : th.en}
                </h3>
              </div>
              <div className="space-y-2.5">
                {list.map((e) => {
                  const busy = busyId === e.id;
                  return (
                    <button
                      key={e.id}
                      onClick={() => onPlay(e.id)}
                      disabled={busy}
                      className="tap group flex w-full items-center gap-3.5 rounded-2xl border border-bark/10 bg-linen-light/70 p-4 text-left transition hover:border-bark/20 active:scale-[0.99] disabled:opacity-60"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-dawn/20 text-clay transition group-hover:bg-dawn/30">
                        {busy ? <span className="animate-glow">◴</span> : "▶"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-lg leading-tight text-bark">
                          {e.title}
                        </span>
                        <span className="mt-0.5 block text-[12px] text-bark-faint">
                          {registerName(e.register, lang)} · {fmtMin(e.totalMs)} min ·{" "}
                          {voiceLabel(e.voice)}
                          {!onlyLang && (
                            <span className="uppercase"> · {e.lang}</span>
                          )}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}

        {shown.length === 0 && (
          <p className="rounded-2xl border border-dashed border-bark/15 px-4 py-6 text-center text-[13px] text-bark-faint">
            {t(
              "Aucune séance dans cette langue. Décochez le filtre pour voir les autres.",
              "No séances in this language. Uncheck the filter to see the others.",
            )}
          </p>
        )}
      </div>
    </div>
  );
}
