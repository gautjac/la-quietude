import { useMemo, useState } from "react";
import { useLang } from "../i18n";
import { themeName, registerName } from "../catalog";
import {
  NEEDS,
  TIME_BUCKETS,
  defaultNeed,
  recommend,
  type TimeBucket,
} from "../recommend";
import type { SeanceIndexEntry } from "../types";

function localDay(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** A two-tap entry: what you need + how long → one suggested sitting. Defaults
 *  to a time-of-day-appropriate need so there's always a sensible first pick. */
export function StartHere({
  entries,
  busyId,
  onPlay,
}: {
  entries: SeanceIndexEntry[];
  busyId: string | null;
  onPlay: (id: string) => void;
}) {
  const { t, lang } = useLang();
  const [needId, setNeedId] = useState(() => defaultNeed(new Date().getHours()));
  const [bucket, setBucket] = useState<TimeBucket>("any");
  const [shuffle, setShuffle] = useState(0);

  const seed = `${localDay()}:${shuffle}`;
  const rec = useMemo(
    () => recommend(entries, { lang, needId, bucket, seed }),
    [entries, lang, needId, bucket, seed],
  );

  if (entries.length === 0) return null;

  return (
    <div className="mb-8 rounded-3xl border border-bark/10 bg-gradient-to-br from-dawn/12 to-sage/10 p-5">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-bark-faint">
        {t("Pour commencer", "Start here")}
      </h3>

      {/* need */}
      <div className="-mx-1 mb-2.5 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">
        {NEEDS.map((n) => {
          const on = needId === n.id;
          return (
            <button
              key={n.id}
              onClick={() => setNeedId(n.id)}
              className={`tap flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition active:scale-[0.97] ${
                on
                  ? "border-clay bg-clay/15 text-bark"
                  : "border-bark/12 bg-linen-light/70 text-bark-soft hover:border-bark/25"
              }`}
            >
              <span className="text-sage-deep">{n.glyph}</span>
              {lang === "fr" ? n.fr : n.en}
            </button>
          );
        })}
      </div>

      {/* time */}
      <div className="mb-4 flex gap-2">
        {TIME_BUCKETS.map((b) => {
          const on = bucket === b.id;
          return (
            <button
              key={b.id}
              onClick={() => setBucket(b.id)}
              className={`tap flex-1 rounded-full border py-1.5 text-[12px] font-medium transition active:scale-[0.97] ${
                on
                  ? "border-sage bg-sage/15 text-bark"
                  : "border-bark/10 bg-linen-light/60 text-bark-faint hover:border-bark/20"
              }`}
            >
              {lang === "fr" ? b.fr : b.en}
            </button>
          );
        })}
      </div>

      {/* the suggestion */}
      {rec && (
        <div className="flex items-center gap-3.5 rounded-2xl border border-bark/10 bg-linen-light/80 p-3.5">
          <button
            onClick={() => onPlay(rec.id)}
            disabled={busyId === rec.id}
            aria-label={t("Jouer", "Play")}
            className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-dawn/25 text-clay transition hover:bg-dawn/35 active:scale-90 disabled:opacity-60"
          >
            {busyId === rec.id ? <span className="animate-glow">◴</span> : "▶"}
          </button>
          <button onClick={() => onPlay(rec.id)} className="min-w-0 flex-1 text-left">
            <span className="block truncate font-display text-lg leading-tight text-bark">
              {rec.title}
            </span>
            <span className="mt-0.5 block text-[12px] text-bark-faint">
              {themeName(rec.theme, lang)} · {registerName(rec.register, lang)} ·{" "}
              {Math.max(1, Math.round(rec.totalMs / 60000))} min
            </span>
          </button>
          <button
            onClick={() => setShuffle((s) => s + 1)}
            aria-label={t("Une autre", "Another")}
            title={t("Une autre", "Another")}
            className="tap flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-bark-faint transition hover:bg-linen-dim hover:text-bark-soft active:scale-90"
          >
            ↻
          </button>
        </div>
      )}
    </div>
  );
}
