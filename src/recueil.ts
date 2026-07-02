// La Quiétude — the Recueil: the reflections you leave after a sitting, and an
// export to Obsidian-flavoured Markdown (matching ~/Claude/wiki: frontmatter +
// wikilinks), so a practice becomes a quiet journal you keep.

import type { HistoryEntry, Lang } from "./types";
import { MOODS, themeName } from "./catalog";

/** History entries that carry a reflection (a mood and/or a note). */
export function reflections(history: HistoryEntry[]): HistoryEntry[] {
  return history.filter((h) => h.mood || (h.note && h.note.trim()));
}

function moodLabel(id: string | undefined, lang: Lang): string | null {
  if (!id) return null;
  const m = MOODS.find((x) => x.id === id);
  return m ? (lang === "fr" ? m.fr : m.en) : null;
}

function isoDate(ms: number): string {
  // stable YYYY-MM-DD from a timestamp, local
  const d = new Date(ms);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

/** Build an Obsidian-friendly Markdown recueil from reflection history. */
export function buildRecueilMarkdown(history: HistoryEntry[], lang: Lang): string {
  const items = reflections(history);
  const title = lang === "fr" ? "Recueil — La Quiétude" : "Recueil — La Quiétude";
  const lines: string[] = [];
  lines.push("---");
  lines.push(`title: ${title}`);
  lines.push("type: reflection");
  lines.push("source: La Quiétude");
  lines.push(`count: ${items.length}`);
  lines.push("tags: [méditation, recueil]");
  lines.push("---");
  lines.push("");
  lines.push(`# ${title}`);
  lines.push("");
  lines.push(
    lang === "fr"
      ? "Ce que chaque séance a laissé — humeur et notes, dans l'ordre du plus récent."
      : "What each sitting left behind — mood and notes, most recent first.",
  );
  lines.push("");

  if (items.length === 0) {
    lines.push(lang === "fr" ? "_(Aucune réflexion pour l'instant.)_" : "_(No reflections yet.)_");
    return lines.join("\n");
  }

  for (const h of items) {
    const date = isoDate(h.at);
    const theme = themeName(h.theme, lang);
    const mood = moodLabel(h.mood, lang);
    lines.push(`## ${date} — [[${theme}]]`);
    const meta = [`${h.length} min`];
    if (mood) meta.push(mood);
    lines.push(`*${meta.join(" · ")}*`);
    if (h.note && h.note.trim()) {
      lines.push("");
      lines.push(`> ${h.note.trim()}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

/** Offer the recueil as a file: native share when available, else a download. */
export async function exportRecueil(markdown: string): Promise<void> {
  const filename = "recueil-quietude.md";
  const blob = new Blob([markdown], { type: "text/markdown" });

  // Prefer the native share sheet on mobile (can save to Files / Obsidian).
  const file = new File([blob], filename, { type: "text/markdown" });
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[]; title?: string }) => Promise<void>;
  };
  if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: "Recueil — La Quiétude" });
      return;
    } catch {
      /* user cancelled or share failed — fall through to download */
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
