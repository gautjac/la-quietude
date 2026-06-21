export type Lang = "fr" | "en";

export type ThemeId =
  | "focus"
  | "sleep"
  | "stress"
  | "grief"
  | "walking"
  | "performance"
  | "gratitude"
  | "bodyscan";

export type RegisterId =
  | "plain"
  | "poetic"
  | "stoic"
  | "buddhist"
  | "acadian";

export type Length = 3 | 5 | 10 | 20;

/** -2 = much more silence … +2 = much more words. */
export type Pacing = -2 | -1 | 0 | 1 | 2;

export type BedId = "rain" | "drone" | "piano" | "ocean" | "room" | "forest";

export interface BedLevels {
  rain: number;
  drone: number;
  piano: number;
  ocean: number;
  room: number;
  forest: number;
}

/** The dials the user sets before a session. */
export interface Dials {
  length: Length;
  theme: ThemeId;
  register: RegisterId;
  pacing: Pacing;
}

/** A spoken line plus the silence to hold after it finishes. */
export interface ScriptLine {
  text: string;
  pauseAfterMs: number;
}

export interface Seance {
  title: string;
  intention: string;
  lines: ScriptLine[];
}

/** A named, saved dial configuration (+ voice + bed mix). */
export interface Preset {
  id: string;
  name: string;
  dials: Dials;
  beds: BedLevels;
  master: number;
  voiceURI: string | null;
  rate: number;
  pitch: number;
  createdAt: number;
}

/** A finished (or partly finished) sitting, for history + streak. */
export interface HistoryEntry {
  id: string;
  date: string; // YYYY-MM-DD (local)
  at: number; // epoch ms
  theme: ThemeId;
  register: RegisterId;
  length: Length;
  lang: Lang;
  completedMs: number;
  plannedMs: number;
  completed: boolean;
}

export interface Favourite {
  id: string;
  title: string;
  intention: string;
  dials: Dials;
  lines: ScriptLine[];
  lang: Lang;
  /** Set when the favourite is a pre-rendered catalogue séance, so it replays
   *  with its real recorded voice rather than the device voice. */
  seanceId?: string;
  createdAt: number;
}

/** One spoken line of a pre-rendered séance: text, hold, and its voiced clip. */
export interface ClipLine {
  text: string;
  pauseAfterMs: number;
  clip: string; // filename within the séance folder, e.g. "001.mp3"
  durationMs: number | null; // measured clip length (ffprobe); null if unknown
}

/** Full metadata for one pre-rendered séance (public/seances/<id>/meta.json). */
export interface SeanceMeta {
  id: string;
  title: string;
  intention: string;
  theme: ThemeId;
  register: RegisterId;
  length: Length;
  lang: Lang;
  pacing: Pacing;
  voice: string; // Edge-TTS voice id, e.g. "fr-CA-SylvieNeural"
  rate: string; // Edge-TTS rate, e.g. "-10%"
  lines: ClipLine[];
  spokenMs: number;
  silenceMs: number;
  totalMs: number;
  createdAt: number;
}

/** Slim catalogue row (public/seances/index.json). */
export interface SeanceIndexEntry {
  id: string;
  title: string;
  intention: string;
  theme: ThemeId;
  register: RegisterId;
  length: Length;
  lang: Lang;
  voice: string;
  lineCount: number;
  totalMs: number;
}

/** Dexie cache row, keyed by a deterministic composite key. */
export interface CachedSeance {
  key: string; // `${theme}|${length}|${register}|${pacing}|${lang}|${variant}`
  theme: ThemeId;
  length: Length;
  register: RegisterId;
  pacing: Pacing;
  lang: Lang;
  seance: Seance;
  createdAt: number;
}
