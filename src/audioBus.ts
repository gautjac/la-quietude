// La Quiétude — a global audio kill switch.
//
// Every sound source (a séance player, the breath pacer, the bed preview, the
// device voice) registers a stopper here and marks itself active while it makes
// sound. `stopAllSound()` silences everything at once, and the UI can show a
// "stop all sound" control whenever anything is playing — so a forgotten
// session can never drone on with no obvious way to kill it.

type Stopper = () => void;

const stoppers = new Set<Stopper>();
let activeCount = 0;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((l) => l());
}

/** Register a function that fully stops a sound source. Returns an unregister. */
export function registerStopper(fn: Stopper): () => void {
  stoppers.add(fn);
  return () => stoppers.delete(fn);
}

/** Mark that a source has started making sound. */
export function pushActive(): void {
  activeCount += 1;
  notify();
}

/** Mark that a source has stopped. */
export function popActive(): void {
  activeCount = Math.max(0, activeCount - 1);
  notify();
}

/** Stop every registered source, plus any device speech, right now. */
export function stopAllSound(): void {
  for (const fn of [...stoppers]) {
    try {
      fn();
    } catch {
      /* keep going — one bad stopper shouldn't block the rest */
    }
  }
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* noop */
  }
}

/** Reactive store for useSyncExternalStore: is anything playing? */
export const audioStore = {
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  getSnapshot(): boolean {
    return activeCount > 0;
  },
};
