// La Quiétude — "start here": one recommended sitting from the catalogue, by
// what you need and how long you have, with a time-of-day default so the app
// meets you where you are instead of showing 40 choices at once.

import type { SeanceIndexEntry, ThemeId, Lang } from "./types";

export interface Need {
  id: string;
  fr: string;
  en: string;
  glyph: string;
  themes: ThemeId[];
}

export const NEEDS: Need[] = [
  { id: "calm", fr: "Me calmer", en: "Calm down", glyph: "≈", themes: ["stress", "bodyscan"] },
  { id: "focus", fr: "Me concentrer", en: "Focus", glyph: "◎", themes: ["focus", "performance"] },
  { id: "sleep", fr: "Dormir", en: "Sleep", glyph: "☾", themes: ["sleep"] },
  { id: "heart", fr: "Le cœur lourd", en: "Heavy heart", glyph: "❀", themes: ["grief", "gratitude"] },
  { id: "thanks", fr: "Rendre grâce", en: "Give thanks", glyph: "♡", themes: ["gratitude"] },
  { id: "move", fr: "En marchant", en: "Walking", glyph: "➶", themes: ["walking"] },
];

export type TimeBucket = "short" | "medium" | "long" | "any";

export const TIME_BUCKETS: { id: TimeBucket; fr: string; en: string }[] = [
  { id: "short", fr: "Court", en: "Short" },
  { id: "medium", fr: "Moyen", en: "Medium" },
  { id: "long", fr: "Long", en: "Long" },
  { id: "any", fr: "Peu importe", en: "Any" },
];

export function needById(id: string): Need | undefined {
  return NEEDS.find((n) => n.id === id);
}

/** A gentle default need for the current time of day. */
export function defaultNeed(hour: number): string {
  if (hour >= 22 || hour < 5) return "sleep";
  if (hour < 11) return "focus";
  if (hour < 17) return "calm";
  return "calm";
}

function inBucket(totalMs: number, bucket: TimeBucket): boolean {
  const min = totalMs / 60000;
  if (bucket === "short") return min <= 6;
  if (bucket === "medium") return min > 6 && min <= 13;
  if (bucket === "long") return min > 13;
  return true;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Pick one sitting. `seed` rotates the choice (e.g. day + a shuffle counter)
 *  so it's stable but not always the same one. Falls back gracefully when a
 *  filter empties the pool. */
export function recommend(
  entries: SeanceIndexEntry[],
  opts: { lang: Lang; needId: string; bucket: TimeBucket; seed: string },
): SeanceIndexEntry | null {
  const langPool = entries.filter((e) => e.lang === opts.lang);
  const base = langPool.length ? langPool : entries;
  if (base.length === 0) return null;

  const need = needById(opts.needId);
  let pool = need ? base.filter((e) => need.themes.includes(e.theme)) : base;
  if (pool.length === 0) pool = base;

  const timed = pool.filter((e) => inBucket(e.totalMs, opts.bucket));
  if (timed.length > 0) pool = timed;

  const idx = hash(opts.seed + opts.needId + opts.bucket) % pool.length;
  return pool[idx];
}
