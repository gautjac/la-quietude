import { useState } from "react";
import { useLang } from "../i18n";

export function Onboarding({ onClose }: { onClose: () => void }) {
  const { t, lang, setLang } = useLang();
  const [step, setStep] = useState(0);

  const slides = [
    {
      glyph: "◎",
      title: t("La Quiétude", "La Quiétude"),
      body: t(
        "Un instrument de méditation guidée que vous accordez. Vous réglez la séance — sa durée, son thème, le ton du guide — et une voix vous accompagne.",
        "A guided-meditation instrument you tune. You set the sitting — its length, its theme, the guide's tone — and a voice accompanies you.",
      ),
    },
    {
      glyph: "≈",
      title: t("La voix, et le fond, séparément", "The voice, and the bed, apart"),
      body: t(
        "La voix vous parle ; le fond sonore se règle à part — pluie, bourdon, océan, piano clairsemé. Mêlez-les à votre goût, ou laissez le silence.",
        "The voice speaks to you; the background bed is mixed separately — rain, drone, ocean, sparse piano. Blend them to taste, or keep silence.",
      ),
    },
    {
      glyph: "☾",
      title: t("Accordée à vous", "Tuned to you"),
      body: t(
        "Gardez vos réglages préférés. Une douce constance suit vos séances, sans jamais vous gronder pour un jour manqué.",
        "Keep your favourite settings. A gentle streak follows your sittings, and never scolds a missed day.",
      ),
    },
    {
      glyph: "♪",
      title: t("Une note honnête", "An honest note"),
      body: t(
        "La voix vient du moteur de synthèse de votre appareil : sa qualité dépend des voix installées. S'il n'y en a aucune, le texte reste affiché, avec le fond et la minuterie.",
        "The voice comes from your device's speech engine: its quality depends on the voices installed. If there are none, the text stays on screen, with the bed and timer.",
      ),
    },
  ];

  const last = step === slides.length - 1;
  const s = slides[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-night/55 px-5 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-linen-light p-8 shadow-lift animate-riseIn">
        <div className="mb-5 flex items-center justify-between">
          <button
            onClick={() => setLang(lang === "fr" ? "en" : "fr")}
            className="tap rounded-full border border-bark/15 px-3 py-1 text-xs font-medium text-bark-soft transition hover:bg-linen-dim"
          >
            {lang === "fr" ? "English" : "Français"}
          </button>
          <button
            onClick={onClose}
            className="tap text-xs font-medium text-bark-faint transition hover:text-bark-soft"
          >
            {t("Passer", "Skip")}
          </button>
        </div>

        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-dawn-warm/40 to-sage/30 text-3xl text-bark-soft">
          {s.glyph}
        </div>

        <h2 className="mb-3 text-3xl text-bark">{s.title}</h2>
        <p className="mb-7 text-[15px] leading-relaxed text-bark-soft text-balance">{s.body}</p>

        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {slides.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-6 bg-dawn" : "w-1.5 bg-bark/20"
                }`}
              />
            ))}
          </div>
          <button
            onClick={() => (last ? onClose() : setStep(step + 1))}
            className="tap rounded-full bg-bark px-6 py-2.5 text-sm font-medium text-linen-light shadow-soft transition hover:bg-bark-soft active:scale-[0.98]"
          >
            {last ? t("Commencer", "Begin") : t("Suivant", "Next")}
          </button>
        </div>
      </div>
    </div>
  );
}
