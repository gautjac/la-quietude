# La Quiétude

A personalizable guided-meditation instrument. You tune the sitting — length, theme,
the guide's register, and pacing — and a voice narrates over an independently mixable,
fully procedural background bed. FR-first, bilingual.

The signature is **personalization + spoken guidance**: the words come from Opus as a
*timed* script (each line carries the silence to hold after it), the voice comes from
your device's `speechSynthesis` engine, and the background bed (rain, drone, sparse
piano, ocean, room-tone, forest) is generated live with Web Audio — no audio files, no
audio API — and mixed entirely apart from the voice.

## Stack
Vite + React 19 + TypeScript + Tailwind v3 + Dexie (local-first) + one Netlify Function
(`/api/seance`, Claude `claude-opus-4-8`, NDJSON keepalive) for script generation.

## Develop
```
npm install
npm run dev      # netlify dev (functions + vite)
npm run build    # tsc -b && vite build
```

Requires `CLAUDE_API_KEY` in the Netlify environment.

## Notes on honesty
Text-to-speech is the real browser engine; quality depends on the OS voices installed.
If no voices load, the session still runs — the text shows on screen with the bed and
the timer. Generated scripts are cached in IndexedDB keyed by (theme, length, register,
pacing, lang) so repeats are instant; "↻" regenerates a fresh take.
