# La Quiétude

A guided-meditation instrument with **two voices**. FR-first, bilingual.

- **Séances (primary)** — a curated catalogue of meditations recorded with a real
  neural voice. Each line is a pre-rendered **Edge-TTS** MP3 clip (the same free
  Microsoft neural-voice flow the `podcast-summaries` app uses); the player plays
  clip → holds the line's timed silence → next, mixed live against the bed. Studio
  quality, instant, fully offline.
- **Accorder / Tune (free mode)** — compose *any* sitting (length, theme, register,
  pacing) and have Opus write a fresh timed script, spoken by your **device's**
  `speechSynthesis` voice. Quality depends on installed OS voices; this is the
  "personalize-anything" path.

The background bed (rain, drone, sparse piano, ocean, room-tone, forest) is generated
live with Web Audio — no sample files — and mixed independently of the voice. A "Voice
volume" control balances the recorded voice against the bed.

## How the voice works
Meditation needs long, precise silences, which Edge-TTS (no SSML) can't bake into one
file. La Quiétude doesn't need it to: the script is already line-by-line with an explicit
`pauseAfterMs`, so each line is rendered as its **own** clip and the silences are held by
the player *between* clips. The voice engine is pluggable (`src/speech.ts`):
`ClipAudioEngine` (MP3 clips) and `BrowserSpeechEngine` (device voice) behind one
`GuidancePlayer`.

## Stack
Vite + React 19 + TypeScript + Tailwind v3 + Dexie (local-first). One Netlify Function
(`/api/seance`, Claude `claude-opus-4-8`, NDJSON keepalive) powers the live free mode.
The séance catalogue is static assets under `public/seances/`.

## Develop
```
npm install
npm run dev            # netlify dev (functions + vite)
npm run build          # tsc -b && vite build
```
`CLAUDE_API_KEY` (Netlify env / `.env`) is needed for the live free mode and for rendering.

## Rendering the séance catalogue
The catalogue is built offline by an idempotent pipeline. Requires the Python
[`edge-tts`](https://github.com/rany2/edge-tts) CLI and `ffprobe` on PATH, plus an API key.

```
npm run render:seances                 # render any séances not yet built
npm run render:seances -- --force      # re-render everything
npm run render:seances -- --only fr-sleep-poetic-10
npm run render:seances -- --index-only # just rebuild index.json
```

- `scripts/catalog.config.cjs` — the curated list of sittings. Add an entry with a new,
  stable `id`, then run the render; existing ids are skipped unless `--force`.
- `scripts/lib/seance-gen.cjs` — generates one timed script with Opus. **Faithful CJS
  port of `netlify/functions/lib/guide.ts`** (briefs + tool schema + retiming). Keep the
  two in sync.
- `scripts/lib/tts-edge.cjs` — Edge-TTS adapter (mirrors the podcast-summaries one), one
  MP3 per line.
- `scripts/lib/voices.cjs` — calm voice per register (FR + EN) and speaking rate per
  theme (sleep/grief slowest).

Output per séance: `public/seances/<id>/{meta.json, 001.mp3, …}` plus a slim
`public/seances/index.json`. `meta.json` carries each line's text, `pauseAfterMs`, clip
name, and ffprobe-measured `durationMs` (for an accurate progress bar).

## Credits
- Sampled piano bed: **FluidR3 GM** by Frank Wen ([CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/)) — eight notes bundled under `public/sounds/piano/`, played through the bed's reverb. Everything else in the sound bed is generated live with Web Audio (no sample files).

## Notes on honesty
The Séances voices are real Microsoft Edge neural voices, pre-rendered — no live TTS API
at runtime. The free-mode voice is the browser engine; if no voices load, the session
still runs (text on screen, with the bed and timer). Live scripts are cached in IndexedDB
keyed by (theme, length, register, pacing, lang) so repeats are instant; "↻" regenerates.
