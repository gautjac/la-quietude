#!/usr/bin/env node
/**
 * voices.cjs — pick a calm Edge-TTS voice (and speaking rate) for a séance.
 *
 * La Quiétude is French-first; every register has a French AND an English
 * voice so the catalogue can carry both. Choices map to each register's tone,
 * the way podcast-summaries' voice-map.cjs maps a voice to each show:
 *
 *   plain     → clear, warm, unadorned   (FR québécoise Sylvie / EN Ava)
 *   poetic    → soft, lyrical            (FR Vivienne / EN Emma)
 *   stoic     → grounded, even, male     (FR Antoine / EN Andrew)
 *   buddhist  → neutral, spacious        (FR Denise / EN Ava)
 *   acadian   → close, down-home         (FR québécoise Sylvie / EN Ava)
 *
 * Edge has no Acadian voice; québécoise Sylvie is the closest in warmth.
 *
 * Speaking rate is slower than the podcast app (which uses -3%): meditation
 * should be unhurried. Rate is chosen by THEME — sleep and grief slowest, a
 * focusing/walking sit a touch livelier.
 */

'use strict';

const DEFAULT = { fr: 'fr-CA-SylvieNeural', en: 'en-US-AvaMultilingualNeural' };

const VOICE_BY_REGISTER = {
  plain: { fr: 'fr-CA-SylvieNeural', en: 'en-US-AvaMultilingualNeural' },
  poetic: { fr: 'fr-FR-VivienneMultilingualNeural', en: 'en-US-EmmaMultilingualNeural' },
  stoic: { fr: 'fr-CA-AntoineNeural', en: 'en-US-AndrewMultilingualNeural' },
  buddhist: { fr: 'fr-FR-DeniseNeural', en: 'en-US-AvaMultilingualNeural' },
  acadian: { fr: 'fr-CA-SylvieNeural', en: 'en-US-AvaMultilingualNeural' },
};

// Rate (Edge-TTS percentage string) by theme. Negative = slower than default.
const RATE_BY_THEME = {
  sleep: '-16%',
  grief: '-14%',
  bodyscan: '-12%',
  stress: '-12%',
  gratitude: '-10%',
  focus: '-8%',
  performance: '-7%',
  walking: '-6%',
};

const DEFAULT_RATE = '-10%';

function voiceFor(register, lang) {
  if (process.env.EDGE_TTS_VOICE) return process.env.EDGE_TTS_VOICE;
  const r = VOICE_BY_REGISTER[register] || DEFAULT;
  return r[lang] || DEFAULT[lang] || DEFAULT.fr;
}

function rateFor(theme) {
  if (process.env.EDGE_TTS_RATE) return process.env.EDGE_TTS_RATE;
  return RATE_BY_THEME[theme] || DEFAULT_RATE;
}

module.exports = { voiceFor, rateFor, VOICE_BY_REGISTER, RATE_BY_THEME, DEFAULT };
