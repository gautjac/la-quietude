import { useMemo, useState } from "react";
import { useLang } from "../i18n";
import { journeysForLang, nextDay, type Journey } from "../journeys";
import type { SeanceIndexEntry, JourneyProgress } from "../types";

function mins(ms: number): number {
  return Math.max(1, Math.round(ms / 60000));
}

export function Parcours({
  entries,
  progress,
  busyId,
  onPlayDay,
}: {
  entries: SeanceIndexEntry[];
  progress: Record<string, JourneyProgress>;
  busyId: string | null;
  onPlayDay: (journeyId: string, dayIndex: number, seanceId: string) => void;
}) {
  const { t, lang } = useLang();
  const [openId, setOpenId] = useState<string | null>(null);

  const journeys = useMemo(() => journeysForLang(lang), [lang]);
  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);

  if (journeys.length === 0) return null;

  const open = journeys.find((j) => j.id === openId) || null;
  const completedFor = (j: Journey) => progress[j.id]?.completed ?? [];

  return (
    <section className="mb-9">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-bark-faint">
        {t("Parcours", "Journeys")}
      </h3>

      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 no-scrollbar">
        {journeys.map((j) => {
          const done = completedFor(j).length;
          const total = j.days.length;
          return (
            <button
              key={j.id}
              onClick={() => setOpenId(j.id)}
              className="tap w-64 shrink-0 rounded-3xl border border-bark/10 bg-gradient-to-br from-sage/12 to-dawn/10 p-4 text-left transition hover:border-bark/20 active:scale-[0.99]"
            >
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xl text-sage-deep">{j.glyph}</span>
                <span className="text-[11px] tabular-nums text-bark-faint">
                  {done}/{total}
                </span>
              </div>
              <div className="font-display text-xl leading-tight text-bark">
                {lang === "fr" ? j.fr : j.en}
              </div>
              <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-bark-faint">
                {lang === "fr" ? j.blurbFr : j.blurbEn}
              </p>
              <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-bark/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-dawn to-sage"
                  style={{ width: `${(done / total) * 100}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {open && (
        <JourneyDetail
          journey={open}
          completed={completedFor(open)}
          entryTitle={(id) => byId.get(id)?.title ?? id}
          entryMs={(id) => byId.get(id)?.totalMs ?? 0}
          busyId={busyId}
          onClose={() => setOpenId(null)}
          onPlayDay={onPlayDay}
        />
      )}
    </section>
  );
}

function JourneyDetail({
  journey,
  completed,
  entryTitle,
  entryMs,
  busyId,
  onClose,
  onPlayDay,
}: {
  journey: Journey;
  completed: number[];
  entryTitle: (id: string) => string;
  entryMs: (id: string) => number;
  busyId: string | null;
  onClose: () => void;
  onPlayDay: (journeyId: string, dayIndex: number, seanceId: string) => void;
}) {
  const { t, lang } = useLang();
  const next = nextDay(journey, completed);
  const allDone = completed.length === journey.days.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-bark/40 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="grain max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-linen sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-sage/15 to-dawn/12 p-6">
          <div className="flex items-start justify-between">
            <span className="text-3xl text-sage-deep">{journey.glyph}</span>
            <button
              onClick={onClose}
              aria-label={t("Fermer", "Close")}
              className="tap flex h-8 w-8 items-center justify-center rounded-full bg-linen-light/60 text-bark-faint transition hover:text-bark-soft"
            >
              ×
            </button>
          </div>
          <h2 className="mt-2 font-display text-2xl text-bark">
            {lang === "fr" ? journey.fr : journey.en}
          </h2>
          <p className="mt-1 text-[13px] leading-snug text-bark-soft">
            {lang === "fr" ? journey.blurbFr : journey.blurbEn}
          </p>
          <p className="mt-2 text-[12px] text-bark-faint">
            {completed.length}/{journey.days.length} {t("jours", "days")}
            {allDone && ` · ${t("parcours terminé", "journey complete")}`}
          </p>
        </div>

        <div className="space-y-2.5 p-5">
          {journey.days.map((seanceId, i) => {
            const isDone = completed.includes(i);
            const isNext = i === next && !allDone;
            const busy = busyId === seanceId;
            return (
              <button
                key={i}
                onClick={() => onPlayDay(journey.id, i, seanceId)}
                disabled={busy}
                className={`tap flex w-full items-center gap-3.5 rounded-2xl border p-3.5 text-left transition active:scale-[0.99] disabled:opacity-60 ${
                  isNext
                    ? "border-dawn bg-dawn/12 shadow-soft"
                    : "border-bark/10 bg-linen-light/70 hover:border-bark/20"
                }`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm ${
                    isDone ? "bg-sage/20 text-sage-deep" : "bg-dawn/20 text-clay"
                  }`}
                >
                  {busy ? <span className="animate-glow">◴</span> : isDone ? "✓" : "▶"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] uppercase tracking-wide text-bark-faint">
                    {t("Jour", "Day")} {i + 1}
                    {isNext && ` · ${t("à suivre", "up next")}`}
                  </span>
                  <span className="block truncate font-display text-lg leading-tight text-bark">
                    {entryTitle(seanceId)}
                  </span>
                  <span className="text-[12px] text-bark-faint">{mins(entryMs(seanceId))} min</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
