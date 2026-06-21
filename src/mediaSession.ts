// La Quiétude — lock-screen / background playback via the Media Session API.
//
// Two jobs:
//   1. Tell the OS what's playing (title, theme, artwork) and accept its
//      transport controls (play / pause / stop / skip from the lock screen,
//      headphones, watch, car).
//   2. Keep the page's audio session alive across the script's SILENCES. A
//      séance is clips separated by JS-timed gaps; with no audio playing during
//      a gap a backgrounded/locked phone can suspend the page and stall the
//      timer. A looping near-silent track holds the session open so the next
//      clip fires on time. (iOS still isn't perfectly reliable here, but this
//      is the standard, best-available approach.)

type Handlers = {
  play: () => void;
  pause: () => void;
  stop: () => void;
  skip: () => void;
};

let artworkUrl: string | null = null;

/** A soft orb, drawn once to a PNG data URL, used as the lock-screen artwork. */
function artwork(): string {
  if (artworkUrl) return artworkUrl;
  try {
    const size = 512;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    if (!ctx) return "";
    ctx.fillStyle = "#efe7da";
    ctx.fillRect(0, 0, size, size);
    const g = ctx.createRadialGradient(
      size * 0.42,
      size * 0.4,
      size * 0.05,
      size * 0.5,
      size * 0.5,
      size * 0.5,
    );
    g.addColorStop(0, "#f6ddc9");
    g.addColorStop(0.55, "#e8c4ac");
    g.addColorStop(1, "rgba(200,160,140,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.42, 0, Math.PI * 2);
    ctx.fill();
    artworkUrl = c.toDataURL("image/png");
    return artworkUrl;
  } catch {
    return "";
  }
}

export function setNowPlaying(title: string, theme: string): void {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  try {
    const art = artwork();
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist: "La Quiétude",
      album: theme,
      artwork: art ? [{ src: art, sizes: "512x512", type: "image/png" }] : [],
    });
  } catch {
    /* noop */
  }
}

export function setActionHandlers(h: Handlers): void {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  const ms = navigator.mediaSession;
  const set = (action: MediaSessionAction, fn: (() => void) | null) => {
    try {
      ms.setActionHandler(action, fn as MediaSessionActionHandler | null);
    } catch {
      /* unsupported action on this platform */
    }
  };
  set("play", h.play);
  set("pause", h.pause);
  set("stop", h.stop);
  set("nexttrack", h.skip); // lock-screen "next" → skip the current silence
  set("seekforward", h.skip);
  set("previoustrack", null);
  set("seekbackward", null);
}

export function setPlaybackState(state: "playing" | "paused" | "none"): void {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  try {
    navigator.mediaSession.playbackState = state;
  } catch {
    /* noop */
  }
}

export function setPosition(durationMs: number, positionMs: number, rate = 1): void {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  if (!("setPositionState" in navigator.mediaSession)) return;
  const duration = durationMs / 1000;
  const position = Math.min(positionMs / 1000, duration);
  if (!Number.isFinite(duration) || duration <= 0) return;
  try {
    navigator.mediaSession.setPositionState({ duration, position, playbackRate: rate });
  } catch {
    /* noop */
  }
}

export function clearMediaSession(): void {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  const ms = navigator.mediaSession;
  try {
    ms.metadata = null;
    ms.playbackState = "none";
    for (const a of [
      "play",
      "pause",
      "stop",
      "nexttrack",
      "previoustrack",
      "seekforward",
      "seekbackward",
    ] as MediaSessionAction[]) {
      try {
        ms.setActionHandler(a, null);
      } catch {
        /* noop */
      }
    }
  } catch {
    /* noop */
  }
}

/** A short silent WAV as a data URL — looped to hold the audio session open. */
function silentWav(): string {
  const sampleRate = 8000;
  const seconds = 1;
  const n = sampleRate * seconds;
  const bytes = 44 + n * 2;
  const buf = new ArrayBuffer(bytes);
  const view = new DataView(buf);
  const w = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  w(0, "RIFF");
  view.setUint32(4, bytes - 8, true);
  w(8, "WAVE");
  w(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  w(36, "data");
  view.setUint32(40, n * 2, true);
  // samples are already zero (silence)
  let bin = "";
  const u8 = new Uint8Array(buf);
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return "data:audio/wav;base64," + btoa(bin);
}

/** Looping silent track that keeps the audio session alive during silences. */
export class KeepAlive {
  private el: HTMLAudioElement | null = null;

  start(): void {
    if (!this.el) {
      this.el = new Audio(silentWav());
      this.el.loop = true;
      this.el.volume = 0;
    }
    void this.el.play().catch(() => {});
  }

  pause(): void {
    try {
      this.el?.pause();
    } catch {
      /* noop */
    }
  }

  stop(): void {
    if (this.el) {
      try {
        this.el.pause();
        this.el.removeAttribute("src");
      } catch {
        /* noop */
      }
      this.el = null;
    }
  }
}
