// La Quiétude — warm the offline cache.
//
// Fetching every séance's meta + clips makes the service worker (cache-first on
// /seances/) store them, so the whole catalogue plays with no network. The app
// shell, fonts, and index are cached on normal use; this covers the heavy audio.

import { loadCatalogue, loadSeanceMeta, clipUrl } from "./seances";

const DONE_KEY = "quietude:offline-done";

export function isDownloaded(): boolean {
  try {
    return localStorage.getItem(DONE_KEY) === "1";
  } catch {
    return false;
  }
}

function markDownloaded(): void {
  try {
    localStorage.setItem(DONE_KEY, "1");
  } catch {
    /* noop */
  }
}

export function clearDownloadedFlag(): void {
  try {
    localStorage.removeItem(DONE_KEY);
  } catch {
    /* noop */
  }
}

/** Fetch every clip in the catalogue (limited concurrency), reporting progress.
 *  Returns the number of clips warmed. */
export async function downloadAllForOffline(
  onProgress: (done: number, total: number) => void,
): Promise<number> {
  const catalogue = await loadCatalogue();
  const urls: string[] = [];
  for (const entry of catalogue) {
    try {
      const meta = await loadSeanceMeta(entry.id);
      for (const line of meta.lines) urls.push(clipUrl(entry.id, line.clip));
    } catch {
      /* skip a séance whose meta won't load */
    }
  }

  // also warm the sampled-piano notes (FluidR3 GM)
  for (const n of ["G3", "A3", "C4", "D4", "E4", "G4", "A4", "C5"]) {
    urls.push(`/sounds/piano/${n}.mp3`);
  }

  const total = urls.length;
  let done = 0;
  onProgress(0, total);

  const CONCURRENCY = 6;
  let next = 0;
  async function worker() {
    while (next < urls.length) {
      const i = next++;
      try {
        await fetch(urls[i], { cache: "no-store" });
      } catch {
        /* a failed clip just won't be offline; keep going */
      }
      done += 1;
      onProgress(done, total);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, worker));

  markDownloaded();
  return total;
}
