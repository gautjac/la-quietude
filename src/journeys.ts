// La Quiétude — Parcours: curated multi-day journeys with an arc. Each day is
// one séance from the catalogue; doing them in order gives a practice a shape.
// Journeys are language-specific (they reference exact séance ids).

import type { Lang } from "./types";

export interface Journey {
  id: string;
  lang: Lang;
  fr: string;
  en: string;
  blurbFr: string;
  blurbEn: string;
  glyph: string;
  days: string[]; // ordered séance ids
}

export const JOURNEYS: Journey[] = [
  // ── French ──────────────────────────────────────────────────────────────
  {
    id: "fr-sommeil",
    lang: "fr",
    fr: "Quatre nuits vers le sommeil",
    en: "Four nights toward sleep",
    blurbFr: "Se défaire du jour, un soir à la fois — jusqu'à sombrer plus doucement.",
    blurbEn: "Let go of the day, one night at a time.",
    glyph: "☾",
    days: ["fr-sleep-plain-10", "fr-sleep-poetic-10", "fr-bodyscan-poetic-20", "fr-sleep-buddhist-20"],
  },
  {
    id: "fr-poser",
    lang: "fr",
    fr: "Cinq jours pour se poser",
    en: "Five days to settle",
    blurbFr: "Dénouer le stress et revenir au corps, un peu plus à chaque séance.",
    blurbEn: "Loosen the stress and return to the body.",
    glyph: "≈",
    days: [
      "fr-stress-plain-5",
      "fr-bodyscan-plain-5",
      "fr-stress-buddhist-10",
      "fr-bodyscan-buddhist-10",
      "fr-stress-poetic-5",
    ],
  },
  {
    id: "fr-concentration",
    lang: "fr",
    fr: "Quatre matins pour se concentrer",
    en: "Four mornings to focus",
    blurbFr: "Rassembler l'attention avant le travail, du plus bref au plus ample.",
    blurbEn: "Gather attention before the work.",
    glyph: "◎",
    days: ["fr-focus-stoic-3", "fr-focus-plain-5", "fr-focus-poetic-5", "fr-focus-buddhist-10"],
  },
  {
    id: "fr-deuil",
    lang: "fr",
    fr: "Traverser le deuil, doucement",
    en: "Through grief, gently",
    blurbFr: "Tenir compagnie à la peine, sans la corriger — trois pas côte à côte.",
    blurbEn: "Keep company with sorrow, without fixing it.",
    glyph: "❀",
    days: ["fr-grief-stoic-5", "fr-grief-poetic-10", "fr-grief-buddhist-10"],
  },

  // ── English ─────────────────────────────────────────────────────────────
  {
    id: "en-sleep",
    lang: "en",
    fr: "Quatre nuits vers le sommeil",
    en: "Four nights toward sleep",
    blurbFr: "Let go of the day, one night at a time.",
    blurbEn: "Let go of the day, one night at a time — until you sink more gently.",
    glyph: "☾",
    days: ["en-sleep-poetic-10", "en-bodyscan-poetic-10", "en-stress-buddhist-10", "en-sleep-acadian-20"],
  },
  {
    id: "en-focus",
    lang: "en",
    fr: "Quelques jours pour se concentrer",
    en: "A few days to steady focus",
    blurbFr: "Gather attention before the work.",
    blurbEn: "Gather attention before the work, from brief to deeper.",
    glyph: "◎",
    days: ["en-focus-stoic-3", "en-focus-plain-5", "en-performance-plain-5"],
  },
];

export function journeysForLang(lang: Lang): Journey[] {
  return JOURNEYS.filter((j) => j.lang === lang);
}

export function getJourney(id: string): Journey | undefined {
  return JOURNEYS.find((j) => j.id === id);
}

/** The first day not yet completed (or the last day when all are done). */
export function nextDay(journey: Journey, completed: number[]): number {
  for (let i = 0; i < journey.days.length; i++) {
    if (!completed.includes(i)) return i;
  }
  return journey.days.length - 1;
}
