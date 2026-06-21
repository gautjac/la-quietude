import Anthropic from "@anthropic-ai/sdk";

export type Lang = "en" | "fr";

export type ThemeId =
  | "focus"
  | "sleep"
  | "stress"
  | "grief"
  | "walking"
  | "performance"
  | "gratitude"
  | "bodyscan";

export type RegisterId = "plain" | "poetic" | "stoic" | "buddhist" | "acadian";

export interface Dials {
  length: 3 | 5 | 10 | 20;
  theme: ThemeId;
  register: RegisterId;
  pacing: -2 | -1 | 0 | 1 | 2;
}

export interface ScriptLine {
  text: string;
  pauseAfterMs: number;
}

export interface Seance {
  title: string;
  intention: string;
  lines: ScriptLine[];
}

const MODEL = "claude-opus-4-8";

function client(): Anthropic {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) throw new Error("Server missing CLAUDE_API_KEY");
  return new Anthropic({ apiKey, baseURL: "https://api.anthropic.com" });
}

function langName(l: Lang): string {
  return l === "fr" ? "French (Québécois, warm and natural — never translated English)" : "English";
}

const THEME_BRIEF: Record<ThemeId, { fr: string; en: string }> = {
  focus: {
    fr: "Concentration : rassembler une attention dispersée avant une période de travail. Pas de sommeil — au contraire, une vigilance calme et disponible.",
    en: "Focus: gather scattered attention before a stretch of work. Not sleepy — a calm, available alertness.",
  },
  sleep: {
    fr: "Endormissement : conduire doucement vers le sommeil. Voix qui décélère, images qui se défont, jamais d'éveil à la fin.",
    en: "Sleep-onset: lead gently toward sleep. A decelerating voice, images that come undone, no waking at the end.",
  },
  stress: {
    fr: "Détente du stress : relâcher la tension du corps et dénouer le souffle. Soupirs d'expiration, épaules qui descendent.",
    en: "Stress-release: release bodily tension and loosen the breath. Sighing exhales, shoulders dropping.",
  },
  grief: {
    fr: "Deuil : tenir compagnie à la peine sans la corriger. Tendresse, permission de ressentir, aucune injonction à 'aller mieux'.",
    en: "Grief: keep company with sorrow without fixing it. Tenderness, permission to feel, no command to 'feel better'.",
  },
  walking: {
    fr: "Marche : méditation les yeux ouverts, en mouvement. Synchroniser l'attention au pas, au contact du pied, à l'air sur la peau.",
    en: "Walking: eyes-open meditation, in motion. Sync attention to the step, the foot's contact, the air on skin.",
  },
  performance: {
    fr: "Avant-scène : apprivoiser le trac avant de monter sur scène ou de jouer. Transformer l'adrénaline en présence, ancrer, puis libérer.",
    en: "Pre-performance: tame nerves before going on stage or playing. Turn adrenaline into presence, ground, then release.",
  },
  gratitude: {
    fr: "Gratitude : réchauffer le cœur sur ce qui est déjà là. Concret, jamais mièvre ; de petites choses réelles.",
    en: "Gratitude: warm the heart on what's already here. Concrete, never saccharine; small real things.",
  },
  bodyscan: {
    fr: "Balayage du corps : visiter le corps région par région, de la tête aux pieds (ou l'inverse), en relâchant à chaque palier.",
    en: "Body-scan: visit the body region by region, head to feet (or reverse), releasing at each stage.",
  },
};

const REGISTER_BRIEF: Record<RegisterId, { fr: string; en: string }> = {
  plain: {
    fr: "Sobre : clair, direct, sans ornement. Des instructions nettes et concrètes.",
    en: "Plain: clear, direct, unadorned. Clean, concrete instructions.",
  },
  poetic: {
    fr: "Poétique : images douces et précises, cadence lente, un peu de lumière — sans jamais devenir précieux.",
    en: "Poetic: soft precise images, slow cadence, a little light — without ever turning precious.",
  },
  stoic: {
    fr: "Stoïcien : dans l'esprit de Marc Aurèle et d'Épictète. Distinguer ce qui dépend de soi de ce qui n'en dépend pas ; accueillir le réel.",
    en: "Stoic: in the spirit of Marcus Aurelius and Epictetus. Distinguish what is up to you from what isn't; meet reality.",
  },
  buddhist: {
    fr: "Bouddhiste neutre : pleine conscience laïque. Noter, laisser passer, revenir au souffle. Aucun jargon religieux, aucune divinité.",
    en: "Buddhist-neutral: secular mindfulness. Note, let pass, return to the breath. No religious jargon, no deities.",
  },
  acadian: {
    fr: "Chaleur acadienne : une voix proche, familière, de chez nous. Tutoiement chaleureux, quelques tournures du pays, sans caricature.",
    en: "Acadian warmth: a close, familiar, down-home voice. Warm and informal, a few regional turns, never a caricature.",
  },
};

/** Budget the script: words vs. silence shift with the pacing dial. */
function pacingPlan(lengthMin: number, pacing: number): {
  spokenShare: number;
  approxLines: number;
} {
  // baseline spoken share of total time by length (longer = more silence)
  const baseShare =
    lengthMin <= 3 ? 0.62 : lengthMin <= 5 ? 0.52 : lengthMin <= 10 ? 0.4 : 0.32;
  // pacing −2..+2 nudges spoken share ±0.18
  const spokenShare = Math.max(0.2, Math.min(0.85, baseShare + pacing * 0.09));
  // a comfortable spoken line ≈ 7s; estimate count from spoken seconds
  const spokenSec = lengthMin * 60 * spokenShare;
  const approxLines = Math.max(6, Math.round(spokenSec / 7));
  return { spokenShare, approxLines };
}

const GUIDE_TOOL: Anthropic.Tool = {
  name: "deliver_seance",
  description:
    "Deliver one complete, timed guided-meditation script as an ordered list of spoken lines, each with the silence (in milliseconds) to hold AFTER it is spoken.",
  input_schema: {
    type: "object",
    required: ["title", "intention", "lines"],
    properties: {
      title: { type: "string", description: "A short, calm title for this sitting (3–6 words)." },
      intention: {
        type: "string",
        description: "One sentence naming the intention of the session, in the session's language.",
      },
      lines: {
        type: "array",
        minItems: 6,
        description:
          "The script in order. Each entry is one spoken unit (one or two short sentences) plus the silence to hold after it.",
        items: {
          type: "object",
          required: ["text", "pauseAfterMs"],
          properties: {
            text: {
              type: "string",
              description:
                "What the narrator says — short, speakable aloud, no stage directions, no markdown, no line numbers.",
            },
            pauseAfterMs: {
              type: "integer",
              minimum: 0,
              maximum: 45000,
              description:
                "Milliseconds of silence to hold after this line finishes, before the next line. Use longer pauses for settling, breath cycles, and the body sinking in.",
            },
          },
        },
      },
    },
  },
};

const VOICE = `You are the guide of La Quiétude — a calm, skilled meditation teacher who writes scripts to be spoken aloud by a text-to-speech voice. Your lines are plain spoken sentences a voice can read: no markdown, no asterisks, no stage directions, no numbered steps, no headings, no emoji. You write idiomatically in the session's language — never translated. You are warm but never mawkish, precise but never clinical. You leave real silence for the body to do its work, and you time it deliberately.`;

export async function generateSeance(dials: Dials, lang: Lang, variant = 0): Promise<Seance> {
  const { spokenShare, approxLines } = pacingPlan(dials.length, dials.pacing);
  const totalMs = dials.length * 60 * 1000;
  const silenceMs = Math.round(totalMs * (1 - spokenShare));

  const theme = THEME_BRIEF[dials.theme];
  const reg = REGISTER_BRIEF[dials.register];

  const brief = [
    `Write ONE complete guided-meditation script in ${langName(lang)}.`,
    "",
    `THEME — ${lang === "fr" ? theme.fr : theme.en}`,
    `REGISTER — ${lang === "fr" ? reg.fr : reg.en}`,
    "",
    `TARGET LENGTH: about ${dials.length} minutes total (spoken + silence).`,
    `Aim for roughly ${approxLines} spoken lines.`,
    `Across the whole script the silences should sum to roughly ${Math.round(
      silenceMs / 1000,
    )} seconds — distribute them so the session breathes: short pauses between close instructions, longer pauses (8–25 seconds) where the listener settles, follows a few breaths, or lets the body sink.`,
    "",
    "SHAPE: open by arriving and settling; develop the theme through the body and breath; close gently in keeping with the theme (for sleep, do NOT re-energize; for focus or pre-performance, return alert and ready).",
    "",
    "RULES:",
    "- Each line is one or two short sentences, speakable aloud in one calm breath or two.",
    "- No markdown, no asterisks, no stage directions, no numbering, no headings, no emoji.",
    "- Vary sentence length; let some lines be very short.",
    "- The very first line should be a gentle welcome; the last line should land softly.",
    variant > 0
      ? "- This is a FRESH take: choose different images, a different route through the theme than an obvious first attempt."
      : "",
    "",
    "Respond only by calling deliver_seance.",
  ]
    .filter(Boolean)
    .join("\n");

  const res = await client().messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: VOICE,
    messages: [{ role: "user", content: brief }],
    tools: [GUIDE_TOOL],
    tool_choice: { type: "tool", name: "deliver_seance" },
  });

  const tool = res.content.find((b) => b.type === "tool_use");
  if (!tool || tool.type !== "tool_use") throw new Error("No séance returned");
  const i = tool.input as Record<string, unknown>;

  const rawLines = Array.isArray(i.lines) ? (i.lines as Record<string, unknown>[]) : [];
  let lines: ScriptLine[] = rawLines
    .map((l) => ({
      text: String(l.text ?? "").trim(),
      pauseAfterMs: clampPause(Number(l.pauseAfterMs ?? 0)),
    }))
    .filter((l) => l.text.length > 0);

  if (lines.length === 0) throw new Error("Empty séance");

  lines = retime(lines, totalMs);

  return {
    title: String(i.title ?? (lang === "fr" ? "Séance" : "Session")).trim(),
    intention: String(i.intention ?? "").trim(),
    lines,
  };
}

function clampPause(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(45000, Math.round(n));
}

/**
 * Gently rescale the model's silences so the projected total lands near the
 * target. We estimate spoken time at ~7s/line, keep that fixed, and scale the
 * silences to fill the remainder (never below 0, never absurdly long). This
 * keeps the session honest to the chosen length without rewriting the words.
 */
function retime(lines: ScriptLine[], targetMs: number): ScriptLine[] {
  const spokenMs = lines.reduce((s, l) => s + estimateSpokenMs(l.text), 0);
  const wantSilence = Math.max(0, targetMs - spokenMs);
  const haveSilence = lines.reduce((s, l) => s + l.pauseAfterMs, 0);
  if (haveSilence <= 0) {
    // spread evenly if the model gave no pauses
    const each = Math.round(wantSilence / lines.length);
    return lines.map((l, idx) => ({
      ...l,
      pauseAfterMs: idx === lines.length - 1 ? Math.min(each, 6000) : each,
    }));
  }
  const scale = wantSilence / haveSilence;
  // keep scale sane: don't inflate beyond 2.5× or shrink below 0.4×
  const s = Math.max(0.4, Math.min(2.5, scale));
  return lines.map((l) => ({ ...l, pauseAfterMs: clampPause(l.pauseAfterMs * s) }));
}

function estimateSpokenMs(text: string): number {
  return Math.max(900, (text.length / 13) * 1000);
}
