import { useMemo, useState } from "react";
import { useLang } from "../i18n";
import type { Voice } from "../speech";

export function VoicePanel({
  voices,
  voiceURI,
  rate,
  pitch,
  onVoice,
  onRate,
  onPitch,
  onPreview,
}: {
  voices: Voice[];
  voiceURI: string | null;
  rate: number;
  pitch: number;
  onVoice: (uri: string) => void;
  onRate: (v: number) => void;
  onPitch: (v: number) => void;
  onPreview: () => void;
}) {
  const { t, lang } = useLang();
  const [filterLang, setFilterLang] = useState(true);

  const filtered = useMemo(() => {
    if (!filterLang) return voices;
    const want = lang === "fr" ? "fr" : "en";
    const m = voices.filter((v) => v.lang.toLowerCase().startsWith(want));
    return m.length > 0 ? m : voices;
  }, [voices, filterLang, lang]);

  const noVoices = voices.length === 0;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-bark-faint">
          {t("La voix", "The voice")}
        </h3>
        {!noVoices && (
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-bark-faint">
            <input
              type="checkbox"
              checked={filterLang}
              onChange={(e) => setFilterLang(e.target.checked)}
              className="accent-dawn"
            />
            {t("voix de la langue", "language voices")}
          </label>
        )}
      </div>

      {noVoices ? (
        <p className="rounded-2xl bg-clay/10 px-4 py-3 text-[13px] leading-snug text-bark-soft">
          {t(
            "Aucune voix de synthèse n'a été trouvée sur cet appareil. La séance jouera quand même : le texte s'affiche, avec le fond et la minuterie.",
            "No speech voices were found on this device. The session still plays: the text shows on screen, with the bed and timer.",
          )}
        </p>
      ) : (
        <>
          <div className="relative">
            <select
              value={voiceURI ?? ""}
              onChange={(e) => onVoice(e.target.value)}
              className="tap w-full appearance-none rounded-2xl border border-bark/12 bg-linen-light/80 px-4 py-3 pr-9 text-sm text-bark transition focus:border-dawn focus:outline-none"
            >
              {filtered.map((v) => (
                <option key={v.uri} value={v.uri}>
                  {v.name} · {v.lang}
                  {v.localService ? "" : " ☁"}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-bark-faint">
              ▾
            </span>
          </div>

          <div className="mt-5 space-y-4">
            <Slider
              label={t("Vitesse", "Rate")}
              value={rate}
              min={0.6}
              max={1.2}
              step={0.05}
              onChange={onRate}
            />
            <Slider
              label={t("Hauteur", "Pitch")}
              value={pitch}
              min={0.6}
              max={1.4}
              step={0.05}
              onChange={onPitch}
            />
          </div>

          <button
            onClick={onPreview}
            className="tap mt-5 w-full rounded-full border border-bark/12 bg-linen-light/70 py-2.5 text-sm font-medium text-bark-soft transition hover:bg-linen-dim active:scale-[0.98]"
          >
            {t("Écouter un aperçu", "Hear a preview")}
          </button>
          <p className="mt-3 text-[12px] leading-snug text-bark-faint">
            {t(
              "La qualité de la voix dépend des voix installées sur votre système.",
              "Voice quality depends on the voices installed on your system.",
            )}
          </p>
        </>
      )}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium text-bark">{label}</span>
        <span className="text-[11px] tabular-nums text-bark-faint">{value.toFixed(2)}×</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        aria-label={label}
      />
    </div>
  );
}
