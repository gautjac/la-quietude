import Dexie, { type Table } from "dexie";
import type {
  Preset,
  HistoryEntry,
  Favourite,
  CachedSeance,
  Dials,
  Lang,
} from "./types";

class QuietudeDB extends Dexie {
  presets!: Table<Preset, string>;
  history!: Table<HistoryEntry, string>;
  favourites!: Table<Favourite, string>;
  cache!: Table<CachedSeance, string>;

  constructor() {
    super("la-quietude");
    this.version(1).stores({
      presets: "id, createdAt",
      history: "id, date, at",
      favourites: "id, createdAt",
      cache: "key, createdAt",
    });
  }
}

export const db = new QuietudeDB();

export function cacheKey(dials: Dials, lang: Lang, variant = 0): string {
  return `${dials.theme}|${dials.length}|${dials.register}|${dials.pacing}|${lang}|${variant}`;
}

const uid = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);

export { uid };

/** Local YYYY-MM-DD (not UTC) so the streak follows the user's day. */
export function localDay(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Gentle streak. Counts consecutive days up to and including today that have at
 * least one entry; a gap simply resets the count — we never surface a "broken"
 * state or a guilt number, only the current run. Returns 0 if today/yesterday
 * is the last sit (so a missed day quietly lapses without scolding).
 */
export function computeStreak(days: Set<string>): number {
  if (days.size === 0) return 0;
  const today = new Date();
  const todayStr = localDay(today);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yStr = localDay(yesterday);

  // anchor: today if sat today, else yesterday if sat yesterday, else 0.
  let cursor: Date;
  if (days.has(todayStr)) cursor = today;
  else if (days.has(yStr)) cursor = yesterday;
  else return 0;

  let streak = 0;
  const c = new Date(cursor);
  while (days.has(localDay(c))) {
    streak += 1;
    c.setDate(c.getDate() - 1);
  }
  return streak;
}
