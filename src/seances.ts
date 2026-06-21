// La Quiétude — the pre-rendered séance catalogue.
//
// The catalogue is a set of static assets under /seances, built offline by
// scripts/render-seances.cjs: an index.json listing every séance, plus one
// folder per séance holding its meta.json and the Edge-TTS voice clips. The app
// fetches the index at startup and a séance's meta.json (with clip filenames +
// durations) when the user opens it.

import type { SeanceIndexEntry, SeanceMeta } from "./types";

const BASE = "/seances";

/** Load the catalogue index. Returns [] if it isn't present (e.g. unrendered). */
export async function loadCatalogue(): Promise<SeanceIndexEntry[]> {
  try {
    const res = await fetch(`${BASE}/index.json`, { cache: "no-cache" });
    if (!res.ok) return [];
    const data = (await res.json()) as SeanceIndexEntry[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** Load one séance's full metadata (lines, clip names, durations). */
export async function loadSeanceMeta(id: string): Promise<SeanceMeta> {
  const res = await fetch(`${BASE}/${id}/meta.json`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Séance ${id} introuvable (${res.status})`);
  return (await res.json()) as SeanceMeta;
}

/** Absolute URL of a clip within a séance folder. */
export function clipUrl(id: string, clip: string): string {
  return `${BASE}/${id}/${clip}`;
}
