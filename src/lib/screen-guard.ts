/**
 * Screen-capture / screen-recording guard.
 *
 * Browsers cannot see OS-level recorders, but we can detect every capture
 * signal the page is allowed to observe:
 *  - getDisplayMedia() being used anywhere in the tab (screen share / recorder)
 *  - a local media track whose displaySurface is a screen/window/tab
 *  - screenshot key combinations (PrintScreen, Meta+Shift+S/3/4/5)
 *
 * When any signal fires we lock the session (strict mode): the remote video and
 * profile are hidden and chat/voice/video are disabled until the user clears it.
 */
import { useEffect, useState } from "react";

export type CaptureReason = "screen-share" | "screenshot-key" | "display-track";

interface GuardState {
  blocked: boolean;
  reason: CaptureReason | null;
  at: number;
}

let state: GuardState = { blocked: false, reason: null, at: 0 };
const listeners = new Set<(s: GuardState) => void>();
let installed = false;

function emit() {
  for (const l of listeners) l(state);
}

export function flagCapture(reason: CaptureReason) {
  state = { blocked: true, reason, at: Date.now() };
  emit();
}

export function clearCapture() {
  state = { blocked: false, reason: null, at: 0 };
  emit();
}

export function getCaptureState(): GuardState {
  return state;
}

/** Returns true when any local track is actually a screen/window/tab capture. */
export function streamIsScreenCapture(stream: MediaStream | null | undefined): boolean {
  if (!stream) return false;
  return stream.getVideoTracks().some((t) => {
    const s = t.getSettings() as MediaTrackSettings & { displaySurface?: string };
    return Boolean(s.displaySurface) || /screen|window|display|capture/i.test(t.label);
  });
}

function installGlobalHooks() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const md = navigator.mediaDevices as MediaDevices | undefined;
  if (md && typeof md.getDisplayMedia === "function") {
    const original = md.getDisplayMedia.bind(md);
    md.getDisplayMedia = async (constraints?: DisplayMediaStreamOptions) => {
      const stream = await original(constraints);
      flagCapture("screen-share");
      stream.getTracks().forEach((t) =>
        t.addEventListener("ended", () => {
          if (state.reason === "screen-share") clearCapture();
        }),
      );
      return stream;
    };
  }

  window.addEventListener("keydown", (e) => {
    const k = e.key;
    const meta = e.metaKey || e.ctrlKey;
    const screenshot =
      k === "PrintScreen" ||
      k === "F13" ||
      (meta && e.shiftKey && ["s", "S", "3", "4", "5"].includes(k));
    if (screenshot) flagCapture("screenshot-key");
  });
}

export const CAPTURE_WARNING =
  "Screen recording is not allowed. Please stop recording to continue.";

/**
 * Subscribe to the guard. `watchStream` lets a call screen also flag the case
 * where the user picked a screen instead of a camera.
 */
export function useScreenCaptureGuard(watchStream?: MediaStream | null) {
  const [snapshot, setSnapshot] = useState<GuardState>(state);

  useEffect(() => {
    installGlobalHooks();
    setSnapshot(state);
    listeners.add(setSnapshot);
    return () => {
      listeners.delete(setSnapshot);
    };
  }, []);

  useEffect(() => {
    if (!watchStream) return;
    const check = () => {
      if (streamIsScreenCapture(watchStream)) flagCapture("display-track");
    };
    check();
    const id = setInterval(check, 3000);
    return () => clearInterval(id);
  }, [watchStream]);

  return {
    blocked: snapshot.blocked,
    reason: snapshot.reason,
    warning: CAPTURE_WARNING,
    clear: clearCapture,
  };
}
