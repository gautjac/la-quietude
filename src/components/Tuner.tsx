import { useLang } from "../i18n";
import { THEMES, REGISTERS, LENGTHS, PACINGS } from "../catalog";
import type { Dials, Length, RegisterId, ThemeId, Pacing } from "../types";

export function Tuner({
  dials,
  setDials,
}: {
  dials: Dials;
  setDials: (d: Dials) => void;
}) {
  const { t, lang } = useLang();

  const setLength = (length: Length) => setDials({ ...dials, length });
  const setTheme = (theme: ThemeId) => setDials({ ...dials, theme });
  const setRegister = (register: RegisterId) => setDials({ ...dials, register });
  const setPacing = (pacing: Pacing) => setDials({ ...dials, pacing });

  const currentReg = REGISTERS.find((r) => r.id === dials.register)!;

  return (
    <div className="space-y-9">
      {/* Length */}
      <section>
        <Label>{t("Durée", "Length")}</Label>
        <div className="grid grid-cols-4 gap-2.5">
          {LENGTHS.map((len) => {
            const on = dials.length === len;
            return (
              <button
                key={len}
                onClick={() => setLength(len)}
                className={`tap rounded-2xl border py-4 text-center transition active:scale-[0.97] ${
                  on
                    ? "border-dawn bg-dawn/15 shadow-soft"
                    : "border-bark/10 bg-linen-light/70 hover:border-bark/20"
                }`}
              >
                <div className="font-display text-3xl leading-none text-bark">{len}</div>
                <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-bark-faint">
                  min
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Theme */}
      <section>
        <Label>{t("Thème", "Theme")}</Label>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {THEMES.map((th) => {
            const on = dials.theme === th.id;
            return (
              <button
                key={th.id}
                onClick={() => setTheme(th.id)}
                className={`tap rounded-2xl border p-3.5 text-left transition active:scale-[0.98] ${
                  on
                    ? "border-sage bg-sage/12 shadow-soft"
                    : "border-bark/10 bg-linen-light/70 hover:border-bark/20"
                }`}
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-lg text-sage-deep">{th.glyph}</span>
                  {on && <span className="text-xs text-sage-deep">●</span>}
                </div>
                <div className="font-display text-lg leading-tight text-bark">
                  {lang === "fr" ? th.fr : th.en}
                </div>
                <div className="mt-1 text-[11px] leading-snug text-bark-faint">
                  {lang === "fr" ? th.blurbFr : th.blurbEn}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Register */}
      <section>
        <Label>{t("Registre du guide", "Guide's register")}</Label>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">
          {REGISTERS.map((r) => {
            const on = dials.register === r.id;
            return (
              <button
                key={r.id}
                onClick={() => setRegister(r.id)}
                className={`tap shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition active:scale-[0.97] ${
                  on
                    ? "border-clay bg-clay/15 text-bark"
                    : "border-bark/10 bg-linen-light/70 text-bark-soft hover:border-bark/20"
                }`}
              >
                {lang === "fr" ? r.fr : r.en}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[13px] italic leading-snug text-bark-faint">
          {lang === "fr" ? currentReg.noteFr : currentReg.noteEn}
        </p>
      </section>

      {/* Pacing */}
      <section>
        <Label>{t("Cadence", "Pacing")}</Label>
        <input
          type="range"
          min={-2}
          max={2}
          step={1}
          value={dials.pacing}
          onChange={(e) => setPacing(Number(e.target.value) as Pacing)}
          className="w-full"
          aria-label={t("Cadence", "Pacing")}
        />
        <div className="mt-2 flex items-center justify-between text-[12px] text-bark-faint">
          <span>{t("Plus de silence", "More silence")}</span>
          <span className="font-medium text-bark-soft">
            {lang === "fr"
              ? PACINGS.find((p) => p.value === dials.pacing)?.fr
              : PACINGS.find((p) => p.value === dials.pacing)?.en}
          </span>
          <span>{t("Plus de paroles", "More words")}</span>
        </div>
      </section>
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
