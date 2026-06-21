import type { Context } from "@netlify/functions";
import { generateSeance, type Dials, type Lang } from "./lib/guide.ts";
import { ndjsonStream, jsonError } from "./lib/stream.ts";

interface Body {
  dials?: Dials;
  lang?: Lang;
  variant?: number;
}

const THEMES = [
  "focus",
  "sleep",
  "stress",
  "grief",
  "walking",
  "performance",
  "gratitude",
  "bodyscan",
];
const REGISTERS = ["plain", "poetic", "stoic", "buddhist", "acadian"];
const LENGTHS = [3, 5, 10, 20];

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return jsonError("POST only", 405);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const lang: Lang = body.lang === "en" ? "en" : "fr";
  const d = body.dials;
  if (
    !d ||
    !THEMES.includes(d.theme) ||
    !REGISTERS.includes(d.register) ||
    !LENGTHS.includes(d.length)
  ) {
    return jsonError("Missing or invalid dials", 400);
  }

  const dials: Dials = {
    length: d.length,
    theme: d.theme,
    register: d.register,
    pacing: Math.max(-2, Math.min(2, Number(d.pacing ?? 0))) as Dials["pacing"],
  };
  const variant = Math.max(0, Math.min(50, Number(body.variant ?? 0)));

  // Opus can take 25–55s; stream NDJSON keepalives, final line carries {result}.
  return ndjsonStream(() => generateSeance(dials, lang, variant));
};
