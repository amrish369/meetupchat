// Call sounds built with the Web Audio API so there are no audio files to load
// (instant start, works offline, nothing to break on slow networks).

type Ctx = AudioContext & { resume: () => Promise<void> };

let ctx: Ctx | null = null;
let unlocked = false;

function getCtx(): Ctx | null {
  if (typeof window === "undefined") return null;
  const AC: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC() as Ctx;
  return ctx;
}

/** Call from any user gesture so mobile browsers allow sound later. */
export function unlockAudio() {
  const c = getCtx();
  if (!c) return;
  void c.resume().catch(() => {});
  if (unlocked) return;
  unlocked = true;
  try {
    const g = c.createGain();
    g.gain.value = 0.0001;
    const o = c.createOscillator();
    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.01);
  } catch {
    /* noop */
  }
}

function blip(c: Ctx, freq: number, at: number, dur: number, vol: number, type: OscillatorType = "sine") {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(vol, at + 0.02);
  g.gain.setTargetAtTime(0, at + dur * 0.6, dur * 0.25);
  o.connect(g);
  g.connect(c.destination);
  o.start(at);
  o.stop(at + dur + 0.1);
}

interface Loop {
  stop: () => void;
}

function startLoop(everyMs: number, play: (c: Ctx) => void): Loop {
  const c = getCtx();
  if (!c) return { stop: () => {} };
  void c.resume().catch(() => {});
  const tick = () => {
    void c.resume().catch(() => {});
    try {
      play(c);
    } catch {
      /* noop */
    }
  };
  tick();
  const id = setInterval(tick, everyMs);
  return { stop: () => clearInterval(id) };
}

let incoming: Loop | null = null;
let outgoing: Loop | null = null;
let vibrateTimer: ReturnType<typeof setInterval> | null = null;

/** Melodic incoming ringtone + vibration, loops until stopped. */
export function startIncomingRing() {
  stopIncomingRing();
  incoming = startLoop(3000, (c) => {
    const t = c.currentTime + 0.02;
    // Two rising chimes, twice — phone-like and pleasant.
    const pattern: Array<[number, number]> = [
      [880, 0],
      [1174.7, 0.16],
      [880, 0.5],
      [1174.7, 0.66],
    ];
    for (const [f, off] of pattern) blip(c, f, t + off, 0.22, 0.22, "triangle");
    blip(c, 587.3, t + 1.05, 0.3, 0.12, "sine");
  });
  const buzz = () => {
    try {
      navigator.vibrate?.([500, 300, 500, 900]);
    } catch {
      /* noop */
    }
  };
  buzz();
  vibrateTimer = setInterval(buzz, 2400);
}

export function stopIncomingRing() {
  incoming?.stop();
  incoming = null;
  if (vibrateTimer) {
    clearInterval(vibrateTimer);
    vibrateTimer = null;
  }
  try {
    navigator.vibrate?.(0);
  } catch {
    /* noop */
  }
}

/** Caller-side "tring... tring..." ringback while waiting for an answer. */
export function startOutgoingRing() {
  stopOutgoingRing();
  outgoing = startLoop(4000, (c) => {
    const t = c.currentTime + 0.02;
    blip(c, 440, t, 0.4, 0.14, "sine");
    blip(c, 480, t, 0.4, 0.1, "sine");
    blip(c, 440, t + 0.6, 0.4, 0.14, "sine");
    blip(c, 480, t + 0.6, 0.4, 0.1, "sine");
  });
}

export function stopOutgoingRing() {
  outgoing?.stop();
  outgoing = null;
}

export function stopAllCallSounds() {
  stopIncomingRing();
  stopOutgoingRing();
}

/** Short chime when the call connects. */
export function playConnectTone() {
  const c = getCtx();
  if (!c) return;
  void c.resume().catch(() => {});
  const t = c.currentTime + 0.02;
  blip(c, 659.3, t, 0.15, 0.16, "triangle");
  blip(c, 987.8, t + 0.14, 0.25, 0.14, "triangle");
}

/** Short tone when the call ends. */
export function playEndTone() {
  const c = getCtx();
  if (!c) return;
  void c.resume().catch(() => {});
  const t = c.currentTime + 0.02;
  blip(c, 494, t, 0.18, 0.14, "sine");
  blip(c, 330, t + 0.16, 0.3, 0.12, "sine");
}
