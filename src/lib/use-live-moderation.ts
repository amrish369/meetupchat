/**
 * Real-time session moderation shared by random chat and private calls:
 *  - samples the local and remote video for explicit content (on-device)
 *  - moderates the local microphone via live speech recognition
 *  - escalates: warn → warn → end session + 24h suspension
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { scanVideoFrame } from "@/lib/nsfw";
import { useVoiceModeration } from "@/lib/voice-moderation";
import { recordViolation } from "@/lib/violations";

const SCAN_INTERVAL_MS = 4000;
const MAX_STRIKES = 3;

interface Options {
  active: boolean;
  localVideo: React.RefObject<HTMLVideoElement | null>;
  remoteVideo?: React.RefObject<HTMLVideoElement | null>;
  sessionId?: string;
  /** Called when the user hits the strike limit — hang up / skip and lock out. */
  onSuspend: () => void;
  /** Disable the local camera track while explicit content is on screen. */
  onBlockLocalVideo?: (blocked: boolean) => void;
}

export function useLiveModeration({
  active,
  localVideo,
  remoteVideo,
  sessionId,
  onSuspend,
  onBlockLocalVideo,
}: Options) {
  const [localExplicit, setLocalExplicit] = useState(false);
  const [remoteExplicit, setRemoteExplicit] = useState(false);
  const [strikes, setStrikes] = useState(0);
  const [suspended, setSuspended] = useState(false);
  const strikeRef = useRef(0);
  const suspendRef = useRef(onSuspend);
  suspendRef.current = onSuspend;
  const blockRef = useRef(onBlockLocalVideo);
  blockRef.current = onBlockLocalVideo;

  const addStrike = useCallback(
    async (kind: "nudity" | "hate", detail: Record<string, unknown>, message: string) => {
      strikeRef.current += 1;
      const n = strikeRef.current;
      setStrikes(n);
      const outcome = await recordViolation(kind, {
        severity: kind === "hate" ? 2 : 3,
        details: detail,
        sessionId,
      });
      if (n >= MAX_STRIKES || outcome?.action === "suspended") {
        setSuspended(true);
        toast.error("Session ended — repeated community-rule violations. Account suspended for 24 hours.");
        suspendRef.current();
      } else {
        toast.warning(`${message} (warning ${n} of ${MAX_STRIKES})`);
      }
    },
    [sessionId],
  );

  // --- Camera / video frame scanning -------------------------------------
  useEffect(() => {
    if (!active) {
      setLocalExplicit(false);
      setRemoteExplicit(false);
      return;
    }
    let cancelled = false;

    const tick = async () => {
      const local = localVideo.current;
      if (local) {
        const v = await scanVideoFrame(local);
        if (cancelled) return;
        if (v.explicit) {
          setLocalExplicit(true);
          blockRef.current?.(true);
          void addStrike(
            "nudity",
            { side: "local", label: v.label, score: Number(v.score.toFixed(3)) },
            "Nudity or sexual content detected on your camera — camera blocked.",
          );
        } else if (!v.borderline) {
          setLocalExplicit(false);
          blockRef.current?.(false);
        }
      }

      const remote = remoteVideo?.current;
      if (remote) {
        const v = await scanVideoFrame(remote);
        if (cancelled) return;
        setRemoteExplicit(v.explicit);
      }
    };

    void tick();
    const id = setInterval(() => void tick(), SCAN_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [active, localVideo, remoteVideo, addStrike]);

  // --- Voice transcript moderation ---------------------------------------
  const { supported: voiceSupported } = useVoiceModeration({
    enabled: active,
    onViolation: (phrase, reason) => {
      void addStrike("hate", { source: "voice", phrase: phrase.slice(0, 200) }, reason);
    },
  });

  return { localExplicit, remoteExplicit, strikes, suspended, voiceSupported };
}
