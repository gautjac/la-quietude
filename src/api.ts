import type { Dials, Lang, Seance } from "./types";

/**
 * Generate a timed guided script with Opus. The function streams NDJSON:
 * bare-newline heartbeats hold the connection during the ~25–55s call, then a
 * final JSON line carries { result } or { error }. We read to end-of-stream and
 * parse the last non-empty line.
 */
export async function generateSeance(opts: {
  dials: Dials;
  lang: Lang;
  variant?: number;
}): Promise<Seance> {
  const en = opts.lang === "en";
  const res = await fetch("/api/seance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });

  const raw = await res.text();
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const last = lines[lines.length - 1] ?? "";

  let parsed: { result?: Seance; error?: string } | null = null;
  try {
    parsed = last ? JSON.parse(last) : null;
  } catch {
    parsed = null;
  }

  const invalid = en ? "Invalid response from the server." : "Réponse invalide du serveur.";
  if (!res.ok) {
    const fallback = en ? `Error ${res.status}` : `Erreur ${res.status}`;
    throw new Error(parsed?.error || fallback);
  }
  if (!parsed) throw new Error(invalid);
  if (parsed.error) throw new Error(parsed.error);
  if (parsed.result) return parsed.result;
  throw new Error(invalid);
}
