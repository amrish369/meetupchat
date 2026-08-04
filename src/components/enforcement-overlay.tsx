/**
 * Full-screen enforcement overlay shown when a community rule is actively
 * being enforced during a live session (screen recording or explicit content).
 */
import { MonitorOff, EyeOff, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export type EnforcementKind = "recording" | "nudity-local" | "nudity-remote" | "suspended";

interface Props {
  kind: EnforcementKind;
  detail?: string;
  strikes?: number;
  onAcknowledge?: () => void;
  onEnd?: () => void;
}

const COPY: Record<EnforcementKind, { title: string; body: string; icon: typeof ShieldAlert }> = {
  recording: {
    title: "Screen recording is not allowed",
    body: "Screen recording is not allowed. Please stop recording to continue. The other person's video and profile are hidden, and chat, voice and video are disabled until you stop.",
    icon: MonitorOff,
  },
  "nudity-local": {
    title: "Explicit content detected on your camera",
    body: "Nudity and sexual content are not allowed. Your camera has been blocked. Cover up and dress appropriately to continue — repeated violations end the session and suspend your account.",
    icon: EyeOff,
  },
  "nudity-remote": {
    title: "Explicit content blocked",
    body: "We blurred the other person's video because it may contain nudity or sexual content. You can skip to the next person, or report them.",
    icon: EyeOff,
  },
  suspended: {
    title: "Session ended",
    body: "Repeated community-rule violations were detected, so this session has ended and your account is suspended for 24 hours.",
    icon: ShieldAlert,
  },
};

export function EnforcementOverlay({ kind, detail, strikes, onAcknowledge, onEnd }: Props) {
  const { title, body, icon: Icon } = COPY[kind];
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/92 px-6 text-center backdrop-blur-md">
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-destructive/20 text-destructive">
        <Icon className="h-8 w-8" />
      </span>
      <h2 className="text-lg font-bold text-white">{title}</h2>
      <p className="max-w-sm text-sm text-white/75">{body}</p>
      {detail && <p className="text-xs text-white/50">{detail}</p>}
      {typeof strikes === "number" && strikes > 0 && (
        <p className="text-xs font-medium text-amber-300">
          Warning {strikes} of 3 — the session ends and your account is suspended on the third.
        </p>
      )}
      <div className="mt-2 flex gap-3">
        {onAcknowledge && (
          <Button variant="secondary" onClick={onAcknowledge}>
            {kind === "recording" ? "I've stopped recording" : "Continue"}
          </Button>
        )}
        {onEnd && (
          <Button variant="destructive" onClick={onEnd}>
            End session
          </Button>
        )}
      </div>
    </div>
  );
}
