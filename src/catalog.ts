import type { ThemeId, RegisterId, Length, Pacing, BedId, Lang } from "./types";

export interface ThemeDef {
  id: ThemeId;
  fr: string;
  en: string;
  blurbFr: string;
  blurbEn: string;
  glyph: string; // a tiny mark for the card
}

export const THEMES: ThemeDef[] = [
  {
    id: "focus",
    fr: "Concentration",
    en: "Focus",
    blurbFr: "Rassembler l'attention avant le travail.",
    blurbEn: "Gather attention before the work.",
    glyph: "◎",
  },
  {
    id: "sleep",
    fr: "Endormissement",
    en: "Sleep-onset",
    blurbFr: "Glisser doucement vers le sommeil.",
    blurbEn: "Slide gently toward sleep.",
    glyph: "☾",
  },
  {
    id: "stress",
    fr: "Détente du stress",
    en: "Stress-release",
    blurbFr: "Relâcher la tension, dénouer le souffle.",
    blurbEn: "Release tension, loosen the breath.",
    glyph: "≈",
  },
  {
    id: "grief",
    fr: "Deuil",
    en: "Grief",
    blurbFr: "Tenir compagnie à ce qui pèse.",
    blurbEn: "Keep company with what weighs.",
    glyph: "❀",
  },
  {
    id: "walking",
    fr: "Marche",
    en: "Walking",
    blurbFr: "Méditer les yeux ouverts, en mouvement.",
    blurbEn: "Meditate eyes open, in motion.",
    glyph: "➶",
  },
  {
    id: "performance",
    fr: "Avant-scène",
    en: "Pre-performance",
    blurbFr: "Apprivoiser le trac avant de monter.",
    blurbEn: "Tame the nerves before you go on.",
    glyph: "✶",
  },
  {
    id: "gratitude",
    fr: "Gratitude",
    en: "Gratitude",
    blurbFr: "Réchauffer le cœur sur ce qui est là.",
    blurbEn: "Warm the heart on what's here.",
    glyph: "♡",
  },
  {
    id: "bodyscan",
    fr: "Balayage du corps",
    en: "Body-scan",
    blurbFr: "Visiter le corps, de la tête aux pieds.",
    blurbEn: "Visit the body, head to feet.",
    glyph: "◈",
  },
];

export interface RegisterDef {
  id: RegisterId;
  fr: string;
  en: string;
  noteFr: string;
  noteEn: string;
}

export const REGISTERS: RegisterDef[] = [
  {
    id: "plain",
    fr: "Sobre",
    en: "Plain",
    noteFr: "Clair, sans ornement. Des instructions nettes.",
    noteEn: "Clear, unadorned. Clean instructions.",
  },
  {
    id: "poetic",
    fr: "Poétique",
    en: "Poetic",
    noteFr: "Images douces, cadence lente, un peu de lumière.",
    noteEn: "Soft images, slow cadence, a little light.",
  },
  {
    id: "stoic",
    fr: "Stoïcien",
    en: "Stoic",
    noteFr: "Ce qui dépend de vous, ce qui n'en dépend pas.",
    noteEn: "What's up to you, what isn't.",
  },
  {
    id: "buddhist",
    fr: "Bouddhiste neutre",
    en: "Buddhist-neutral",
    noteFr: "Pleine conscience laïque : noter, laisser passer.",
    noteEn: "Secular mindfulness: note, let pass.",
  },
  {
    id: "acadian",
    fr: "Chaleur acadienne",
    en: "Acadian warmth",
    noteFr: "Une voix proche, familière, du pays.",
    noteEn: "A close, familiar, down-home voice.",
  },
];

export const LENGTHS: Length[] = [3, 5, 10, 20];

export const PACINGS: { value: Pacing; fr: string; en: string }[] = [
  { value: -2, fr: "Beaucoup de silence", en: "Much more silence" },
  { value: -1, fr: "Plus de silence", en: "More silence" },
  { value: 0, fr: "Équilibre", en: "Balanced" },
  { value: 1, fr: "Plus de paroles", en: "More words" },
  { value: 2, fr: "Beaucoup de paroles", en: "Much more words" },
];

export interface BedDef {
  id: BedId;
  fr: string;
  en: string;
  glyph: string;
}

export const BEDS: BedDef[] = [
  { id: "rain", fr: "Pluie", en: "Rain", glyph: "☂" },
  { id: "drone", fr: "Bourdon", en: "Drone", glyph: "∿" },
  { id: "piano", fr: "Piano clairsemé", en: "Sparse piano", glyph: "♪" },
  { id: "ocean", fr: "Océan", en: "Ocean", glyph: "≋" },
  { id: "room", fr: "Air de pièce", en: "Room-tone", glyph: "▢" },
  { id: "forest", fr: "Forêt", en: "Forest", glyph: "❦" },
];

export function themeName(id: ThemeId, lang: Lang): string {
  const t = THEMES.find((x) => x.id === id);
  return t ? (lang === "fr" ? t.fr : t.en) : id;
}

export function registerName(id: RegisterId, lang: Lang): string {
  const r = REGISTERS.find((x) => x.id === id);
  return r ? (lang === "fr" ? r.fr : r.en) : id;
}
