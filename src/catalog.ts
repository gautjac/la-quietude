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
  { id: "ocean", fr: "Océan", en: "Ocean", glyph: "≋" },
  { id: "forest", fr: "Forêt", en: "Forest", glyph: "❦" },
  { id: "wind", fr: "Vent", en: "Wind", glyph: "≈" },
  { id: "night", fr: "Nuit", en: "Night", glyph: "☾" },
  { id: "fire", fr: "Feu", en: "Fire", glyph: "✷" },
  { id: "drone", fr: "Bourdon", en: "Drone", glyph: "∿" },
  { id: "hum", fr: "Om", en: "Om", glyph: "◍" },
  { id: "bowls", fr: "Bols chantants", en: "Singing bowls", glyph: "◉" },
  { id: "piano", fr: "Piano clairsemé", en: "Sparse piano", glyph: "♪" },
  { id: "room", fr: "Air de pièce", en: "Room-tone", glyph: "▢" },
];

export interface BedScene {
  id: string;
  fr: string;
  en: string;
  beds: Partial<Record<BedId, number>>;
}

/** Curated one-tap bed mixes. */
export const SCENES: BedScene[] = [
  { id: "nightrain", fr: "Pluie de nuit", en: "Night rain", beds: { rain: 0.6, night: 0.22, hum: 0.18 } },
  { id: "shore", fr: "Rivage", en: "Shore", beds: { ocean: 0.6, wind: 0.16, drone: 0.14 } },
  { id: "temple", fr: "Temple", en: "Temple", beds: { bowls: 0.5, hum: 0.3, drone: 0.18 } },
  { id: "dawnforest", fr: "Forêt à l'aube", en: "Forest at dawn", beds: { forest: 0.5, wind: 0.18, piano: 0.14 } },
  { id: "hearth", fr: "Foyer", en: "Hearth", beds: { fire: 0.5, room: 0.2, hum: 0.18 } },
  { id: "stillroom", fr: "Pièce calme", en: "Still room", beds: { room: 0.4, drone: 0.16, piano: 0.12 } },
];

import type { Mood } from "./types";

export interface MoodDef {
  id: Mood;
  glyph: string;
  fr: string;
  en: string;
}

export const MOODS: MoodDef[] = [
  { id: "calmer", glyph: "◡", fr: "Plus calme", en: "Calmer" },
  { id: "lighter", glyph: "☼", fr: "Plus léger", en: "Lighter" },
  { id: "tender", glyph: "♡", fr: "Attendri", en: "Tender" },
  { id: "restless", glyph: "≁", fr: "Encore agité", en: "Restless" },
  { id: "sleepy", glyph: "☾", fr: "Somnolent", en: "Sleepy" },
];

export function moodDef(id: Mood): MoodDef | undefined {
  return MOODS.find((m) => m.id === id);
}

/** Guided-breathing patterns for the breath pacer. Phases in seconds. */
export interface BreathPhase {
  kind: "in" | "hold" | "out" | "rest";
  sec: number;
}
export interface BreathPattern {
  id: string;
  fr: string;
  en: string;
  noteFr: string;
  noteEn: string;
  phases: BreathPhase[];
}

export const BREATH_PATTERNS: BreathPattern[] = [
  {
    id: "coherence",
    fr: "Cohérence",
    en: "Coherence",
    noteFr: "Cinq secondes à l'inspir, cinq à l'expir. L'équilibre du cœur.",
    noteEn: "Five seconds in, five out. The heart's even keel.",
    phases: [
      { kind: "in", sec: 5 },
      { kind: "out", sec: 5 },
    ],
  },
  {
    id: "calm",
    fr: "Apaisante",
    en: "Calming",
    noteFr: "Expiration plus longue que l'inspiration : le frein du système nerveux.",
    noteEn: "A longer exhale than inhale: the nervous system's brake.",
    phases: [
      { kind: "in", sec: 4 },
      { kind: "out", sec: 6 },
    ],
  },
  {
    id: "box",
    fr: "Carrée",
    en: "Box",
    noteFr: "Quatre temps égaux : inspirez, retenez, expirez, retenez.",
    noteEn: "Four equal counts: in, hold, out, hold.",
    phases: [
      { kind: "in", sec: 4 },
      { kind: "hold", sec: 4 },
      { kind: "out", sec: 4 },
      { kind: "hold", sec: 4 },
    ],
  },
  {
    id: "478",
    fr: "4-7-8",
    en: "4-7-8",
    noteFr: "Inspirez 4, retenez 7, expirez 8. Pour glisser vers le sommeil.",
    noteEn: "In 4, hold 7, out 8. To slip toward sleep.",
    phases: [
      { kind: "in", sec: 4 },
      { kind: "hold", sec: 7 },
      { kind: "out", sec: 8 },
    ],
  },
];

export function themeName(id: ThemeId, lang: Lang): string {
  const t = THEMES.find((x) => x.id === id);
  return t ? (lang === "fr" ? t.fr : t.en) : id;
}

export function registerName(id: RegisterId, lang: Lang): string {
  const r = REGISTERS.find((x) => x.id === id);
  return r ? (lang === "fr" ? r.fr : r.en) : id;
}
