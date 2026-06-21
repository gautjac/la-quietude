import { useLang } from "../i18n";
import { BEDS } from "../catalog";
import type { BedLevels, BedId } from "../types";

const SLEEP_TIMERS = [0, 5, 10, 20];

export function BedPanel({
  beds,
  master,
  onBed,
  onMaster,
  sleepTimerMin,
  onSleepTimer,
}: {
  beds: BedLevels;
  master: number;
  onBed: (id: BedId, v: number) => void;
  onMaster: (v: number) => void;
  sleepTimerMin: number;
  onSleepTimer: (v: number) => void;
}) {
  const { t, lang } = useLang();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-bark-faint">
          {t("Fond sonore", "Background bed")}
        </h3>
        <span className="text-[11px] italic text-bark-faint">
          {t("entièrement génératif", "fully generative")}
        </span>
      </div>

      <div className="space-y-3.5">
        {BEDS.map((bed) => {
          const v = beds[bed.id];
          const on = v > 0.001;
          return (
            <div key={bed.id} className="flex items-center gap-3">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base transition ${
                  on ? "bg-sage/20 text-sage-deep" : "bg-bark/5 text-bark-faint"
                }`}
              >
                {bed.glyph}
              </span>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={`text-sm font-medium ${on ? "text-bark" : "text-bark-faint"}`}
                  >
                    {lang === "fr" ? bed.fr : bed.en}
                  </span>
                  <span className="text-[11px] tabular-nums text-bark-faint">
                    {Math.round(v * 100)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={v}
                  onChange={(e) => onBed(bed.id, Number(e.target.value))}
                  className="sage w-full"
                  aria-label={lang === "fr" ? bed.fr : bed.en}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 border-t border-bark/10 pt-4">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-medium text-bark">{t("Volume du fond", "Bed volume")}</span>
          <span className="text-[11px] tabular-nums text-bark-faint">
            {Math.round(master * 100)}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={master}
          onChange={(e) => onMaster(Number(e.target.value))}
          className="w-full"
          aria-label={t("Volume du fond", "Bed volume")}
        />
      </div>

      <div className="mt-6 border-t border-bark/10 pt-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-bark">
            {t("Minuterie de sommeil", "Sleep timer")}
          </span>
          <span className="text-[11px] italic text-bark-faint">
            {t("le fond s'estompe après la voix", "the bed fades after the voice")}
          </span>
        </div>
        <div className="flex gap-2">
          {SLEEP_TIMERS.map((m) => {
            const on = sleepTimerMin === m;
            return (
              <button
                key={m}
                onClick={() => onSleepTimer(m)}
                className={`tap flex-1 rounded-full border py-2 text-[13px] font-medium transition active:scale-[0.97] ${
                  on
                    ? "border-clay bg-clay/15 text-bark"
                    : "border-bark/10 bg-linen-light/70 text-bark-soft hover:border-bark/20"
                }`}
              >
                {m === 0 ? t("Aucune", "Off") : `${m} min`}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
