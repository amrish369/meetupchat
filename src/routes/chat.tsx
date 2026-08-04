import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  Flag,
  SkipForward,
  Send,
  X,
  Loader2,
  ArrowLeft,
  Shield,
  Wifi,
  Users,
  Search,
  Handshake,
  Radio,
  CheckCircle2,
  Shuffle,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  SwitchCamera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Matchmaker, type ChatMessage, type MatchStatus } from "@/lib/matchmaker";
import { getSessionId } from "@/lib/session";
import { moderateText } from "@/lib/moderation";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, isPremiumActive } from "@/lib/auth";
import { AgeGate } from "@/components/age-gate";
import { EnforcementOverlay } from "@/components/enforcement-overlay";
import { useScreenCaptureGuard } from "@/lib/screen-guard";
import { useLiveModeration } from "@/lib/use-live-moderation";
import { recordViolation } from "@/lib/violations";


export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Live chat — Meetup" },
      {
        name: "description",
        content:
          "Start a random anonymous video chat. No login required. India-focused, safety-first random chat.",
      },
      { property: "og:title", content: "Live anonymous video chat — Meetup" },
      {
        property: "og:description",
        content: "Random one-on-one video chat. Press start to meet someone new.",
      },
    ],
  }),
  component: () => (
    <AgeGate>
      <ChatRoom />
    </AgeGate>
  ),

});

type PhaseKey =
  | "media"
  | "searching"
  | "matched"
  | "signaling"
  | "connected"
  | "relay"
  | "disconnected"
  | "error";

interface PhaseEvent {
  id: string;
  phase: PhaseKey;
  label: string;
  detail?: string;
  at: number;
}

function ChatRoom() {
  const { profile } = useAuth();
  const premium = isPremiumActive(profile);
  const [filterGender, setFilterGender] = useState<string>("any");
  const [filterRegion, setFilterRegion] = useState<string>("any");
  const [status, setStatus] = useState<MatchStatus>("idle");
  const [statusInfo, setStatusInfo] = useState<string | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [peerSession, setPeerSession] = useState<string | null>(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [phases, setPhases] = useState<PhaseEvent[]>([]);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const matcherRef = useRef<Matchmaker | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastPhaseRef = useRef<PhaseKey | null>(null);

  const sessionId =
    typeof window !== "undefined" ? getSessionId() : "";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => {
      matcherRef.current?.stop();
    };
  }, []);

  // Tick a clock while connecting/connected so elapsed timers update live.
  useEffect(() => {
    if (status === "idle") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [status]);

  const pushPhase = useCallback(
    (phase: PhaseKey, label: string, detail?: string) => {
      if (lastPhaseRef.current === phase) return;
      lastPhaseRef.current = phase;
      setPhases((prev) => [
        ...prev,
        {
          id: `${phase}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          phase,
          label,
          detail,
          at: Date.now(),
        },
      ]);
    },
    [],
  );

  const start = useCallback(async () => {
    if (!sessionId) return;
    if (matcherRef.current) await matcherRef.current.stop();

    setMessages([]);
    setPhases([]);
    lastPhaseRef.current = null;
    const m = new Matchmaker(sessionId, {
      onStatus: (s, info) => {
        setStatus(s);
        setStatusInfo(info);
        if (s === "error" && info) toast.error(info);
        if (s === "requesting-media") pushPhase("media", "Requesting camera & mic", info);
        else if (s === "searching") pushPhase("searching", "Searching for a partner", info);
        else if (s === "connecting") {
          if (info && /relay/i.test(info)) {
            lastPhaseRef.current = null; // allow distinct relay event
            pushPhase("relay", "Relay fallback (TURN)", info);
          } else {
            pushPhase("signaling", "Signaling & ICE negotiation", info);
          }
        } else if (s === "connected") pushPhase("connected", "Connected", info);
        else if (s === "disconnected") pushPhase("disconnected", "Disconnected", info);
        else if (s === "error") pushPhase("error", "Error", info);
      },
      onLocalStream: (s) => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = s ?? null;
        }
      },
      onRemoteStream: (s) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = s;
        }
      },
      onMessage: (msg) => setMessages((prev) => [...prev, msg]),
      onPeerSession: (id) => {
        setPeerSession(id);
        if (id) {
          lastPhaseRef.current = null;
          pushPhase("matched", "Matched with stranger", `#${id.slice(0, 6)}`);
        }
      },
      onOnlineCount: (n) => setOnlineCount(n),
    });
    matcherRef.current = m;
    await m.start({
      gender: (profile?.gender as "male" | "female" | "other" | null) ?? null,
      region: profile?.region ?? null,
      filterGender: premium && filterGender !== "any" ? (filterGender as "male" | "female") : null,
      filterRegion: premium && filterRegion !== "any" ? filterRegion : null,
      isPremium: premium,
    });
  }, [sessionId, pushPhase, profile, premium, filterGender, filterRegion]);

  const stop = useCallback(async () => {
    await matcherRef.current?.stop();
    matcherRef.current = null;
    setMessages([]);
    setPeerSession(null);
    setPhases([]);
    lastPhaseRef.current = null;
  }, []);

  const skip = useCallback(async () => {
    if (!matcherRef.current) return;
    setMessages([]);
    setPhases([]);
    lastPhaseRef.current = null;
    await matcherRef.current.skip();
  }, []);

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    if (captureGuard.blocked) {
      toast.error(captureGuard.warning);
      return;
    }
    const check = moderateText(text);
    if (!check.ok) {
      toast.warning(check.reason ?? "Message blocked");
      if (check.severity >= 2) {
        void recordViolation("hate", {
          severity: 2,
          details: { source: "random-chat-text", matched: check.matched },
          sessionId,
        });
      }
      return;
    }
    const ok = matcherRef.current?.sendMessage(check.clean) ?? false;
    if (!ok) toast.error("Not connected to anyone yet");
    setInput("");
  }, [input, captureGuard.blocked, captureGuard.warning, sessionId]);


  const toggleMic = () => {
    setMuted((m) => {
      matcherRef.current?.toggleAudio(m); // m is current → toggling means enabled = m
      return !m;
    });
  };
  const toggleCam = () => {
    setCamOff((c) => {
      matcherRef.current?.toggleVideo(c);
      return !c;
    });
  };

  const remoteWrapRef = useRef<HTMLDivElement>(null);
  const localWrapRef = useRef<HTMLDivElement>(null);
  const [fsTarget, setFsTarget] = useState<null | "local" | "remote">(null);

  const toggleFullscreen = async (which: "local" | "remote") => {
    const el = which === "local" ? localWrapRef.current : remoteWrapRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setFsTarget(null);
      } else {
        await el.requestFullscreen();
        setFsTarget(which);
      }
    } catch {
      toast.error("Fullscreen not supported");
    }
  };

  useEffect(() => {
    const handler = () => { if (!document.fullscreenElement) setFsTarget(null); };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const [facing, setFacing] = useState<"user" | "environment">("user");
  const switchCamera = async () => {
    try {
      const next = await matcherRef.current?.switchCamera();
      if (next) {
        setFacing(next);
        toast.success(next === "user" ? "Front camera" : "Back camera");
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const currentPhase = phases[phases.length - 1];
  const relayActive = useMemo(() => phases.some((p) => p.phase === "relay"), [phases]);
  const startedAt = phases[0]?.at;
  const elapsed = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;

  return (
    <div className="flex h-[100dvh] flex-col bg-deep text-cream">
      <header className="flex items-center justify-between gap-2 border-b border-cream/10 bg-deep/80 px-4 py-3 backdrop-blur">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-cream/75 hover:text-cream">
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-teal-grad text-white">
            <Shield className="h-3.5 w-3.5" />
          </span>
          <span className="font-display text-sm font-semibold">Meetup Live</span>
          {onlineCount > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-[11px] font-medium text-success"
              title="People online right now"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              <Users className="h-3 w-3" />
              {onlineCount.toLocaleString("en-IN")} online
            </span>
          )}
        </div>
        <PhaseChip
          status={status}
          currentPhase={currentPhase}
          relayActive={relayActive}
          elapsed={elapsed}
          open={timelineOpen}
          onToggle={() => setTimelineOpen((v) => !v)}
        />
      </header>

      {status === "idle" && (
        <div className="flex flex-wrap items-center justify-center gap-2 border-b border-cream/10 bg-deep/60 px-4 py-2 text-xs">
          {premium ? (
            <>
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-grad px-2 py-0.5 text-[10px] font-semibold text-white">PREMIUM</span>
              <span className="text-cream/60">Filters:</span>
              <Select value={filterGender} onValueChange={setFilterGender}>
                <SelectTrigger className="h-7 w-[110px] border-cream/15 bg-cream/5 text-cream"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="any">Any gender</SelectItem><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem></SelectContent>
              </Select>
              <Select value={filterRegion} onValueChange={setFilterRegion}>
                <SelectTrigger className="h-7 w-[130px] border-cream/15 bg-cream/5 text-cream"><SelectValue /></SelectTrigger>
                <SelectContent>{["any","India","South Asia","Asia","Europe","Americas","Africa","Oceania"].map(r=> <SelectItem key={r} value={r}>{r==="any"?"Any region":r}</SelectItem>)}</SelectContent>
              </Select>
            </>
          ) : (
            <Link to="/premium" className="inline-flex items-center gap-1 rounded-full bg-teal/15 px-3 py-1 text-teal-soft hover:bg-teal/25">
              ✨ Unlock gender & region filters with Premium
            </Link>
          )}
        </div>
      )}

      {timelineOpen && phases.length > 0 && (
        <PhaseTimeline phases={phases} now={now} onClose={() => setTimelineOpen(false)} />
      )}

      <main className="flex flex-1 min-h-0 flex-col lg:flex-row">
        <section className="relative flex-1 min-h-0 bg-black">
          <div ref={remoteWrapRef} className="relative h-full w-full bg-black" onDoubleClick={() => status === "connected" && toggleFullscreen("remote")}>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="h-full w-full object-cover cursor-pointer"
            />
            {status === "connected" && (
              <button
                onClick={() => toggleFullscreen("remote")}
                aria-label="Toggle fullscreen for stranger's video"
                className="absolute right-3 bottom-24 sm:bottom-3 grid h-10 w-10 place-items-center rounded-full bg-deep/70 text-cream backdrop-blur hover:bg-deep/90"
              >
                {fsTarget === "remote" ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            )}
          </div>

          {(status === "idle" || status === "searching" || status === "requesting-media") && (
            <Overlay status={status} statusInfo={statusInfo} onStart={start} />
          )}

          {status !== "idle" && (
            <div
              ref={localWrapRef}
              className="absolute right-3 top-3 aspect-[3/4] w-28 overflow-hidden rounded-xl border-2 border-cream/20 bg-deep shadow-elev sm:w-36"
            >
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
                style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }}
              />
              {camOff && (
                <div className="absolute inset-0 grid place-items-center bg-deep/90">
                  <VideoOff className="h-6 w-6 text-cream/60" />
                </div>
              )}
              <div className="absolute inset-x-1 bottom-1 flex justify-between gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); void switchCamera(); }}
                  aria-label="Switch camera"
                  className="grid h-7 w-7 place-items-center rounded-full bg-deep/80 text-cream backdrop-blur hover:bg-deep"
                >
                  <SwitchCamera className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); void toggleFullscreen("local"); }}
                  aria-label="Fullscreen own camera"
                  className="grid h-7 w-7 place-items-center rounded-full bg-deep/80 text-cream backdrop-blur hover:bg-deep"
                >
                  {fsTarget === "local" ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          )}

          {status === "connected" && peerSession && (
            <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-deep/70 px-3 py-1 text-xs text-cream backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              Connected · stranger #{peerSession.slice(0, 6)}
              <span className="ml-1 tabular-nums text-cream/60">{formatElapsed(elapsed)}</span>
              {relayActive && (
                <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                  <Shuffle className="h-2.5 w-2.5" /> relay
                </span>
              )}
            </div>
          )}

          {status !== "idle" && (
            <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-2 bg-gradient-to-t from-black/70 to-transparent p-4 sm:gap-3">
              <ControlBtn label={muted ? "Unmute" : "Mute"} onClick={toggleMic} active={!muted}>
                {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </ControlBtn>
              <ControlBtn label={camOff ? "Camera on" : "Camera off"} onClick={toggleCam} active={!camOff}>
                {camOff ? <VideoOff className="h-5 w-5" /> : <VideoIcon className="h-5 w-5" />}
              </ControlBtn>
              <ControlBtn label="Switch camera" onClick={switchCamera}>
                <SwitchCamera className="h-5 w-5" />
              </ControlBtn>
              <button
                onClick={skip}
                className="flex h-14 items-center gap-2 rounded-full bg-teal-grad px-6 font-semibold text-white shadow-glow transition-transform hover:scale-105 active:scale-95"
              >
                <SkipForward className="h-5 w-5" /> Next
              </button>
              <ControlBtn label="Fullscreen" onClick={() => toggleFullscreen("remote")}>
                {fsTarget === "remote" ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
              </ControlBtn>
              <ControlBtn
                label="Report"
                onClick={() => setReportOpen(true)}
                className="bg-destructive text-destructive-foreground"
              >
                <Flag className="h-5 w-5" />
              </ControlBtn>
              <ControlBtn label="End" onClick={stop} className="bg-cream/10">
                <X className="h-5 w-5" />
              </ControlBtn>
            </div>
          )}
        </section>


        <aside className="flex h-72 flex-col border-t border-cream/10 bg-deep/95 lg:h-auto lg:w-96 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between border-b border-cream/10 px-4 py-3">
            <h3 className="font-display text-sm font-semibold">Text chat</h3>
            <span className="text-[10px] uppercase tracking-wider text-cream/50">P2P · encrypted</span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
            {messages.length === 0 ? (
              <p className="mt-4 text-center text-xs text-cream/50">
                Say hi! Messages here are sent peer-to-peer.
              </p>
            ) : (
              <ul className="space-y-2">
                {messages.map((m) => (
                  <li
                    key={m.id}
                    className={
                      m.from === "system"
                        ? "text-center text-[11px] text-cream/55"
                        : m.from === "me"
                          ? "ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-teal px-3 py-2 text-sm text-white"
                          : "mr-auto max-w-[80%] rounded-2xl rounded-bl-sm bg-cream/10 px-3 py-2 text-sm text-cream"
                    }
                  >
                    {m.text}
                  </li>
                ))}
              </ul>
            )}
            <div ref={messagesEndRef} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex gap-2 border-t border-cream/10 p-3"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={status === "connected" ? "Type a message…" : "Waiting for match…"}
              disabled={status !== "connected"}
              maxLength={500}
              className="border-cream/15 bg-cream/5 text-cream placeholder:text-cream/40 focus-visible:ring-teal"
            />
            <Button
              type="submit"
              variant="hero"
              size="icon"
              disabled={status !== "connected" || !input.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </aside>
      </main>

      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        reporter={sessionId}
        reported={peerSession}
        onSubmitted={() => skip()}
      />
      <Toaster richColors position="top-center" theme="dark" />
    </div>
  );
}

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatTime(at: number) {
  const d = new Date(at);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

const PHASE_META: Record<
  PhaseKey,
  { label: string; color: string; icon: typeof Wifi; spin?: boolean }
> = {
  media: { label: "Camera", color: "bg-cream/10 text-cream/80", icon: VideoIcon },
  searching: { label: "Searching", color: "bg-teal/20 text-teal-soft", icon: Search, spin: false },
  matched: { label: "Matched", color: "bg-teal/25 text-teal-soft", icon: Handshake },
  signaling: { label: "Signaling", color: "bg-teal/20 text-teal-soft", icon: Radio, spin: true },
  relay: { label: "Relay (TURN)", color: "bg-amber-400/20 text-amber-200", icon: Shuffle },
  connected: { label: "Connected", color: "bg-success/20 text-success", icon: CheckCircle2 },
  disconnected: { label: "Disconnected", color: "bg-destructive/20 text-destructive", icon: X },
  error: { label: "Error", color: "bg-destructive/20 text-destructive", icon: X },
};

function PhaseChip({
  status,
  currentPhase,
  relayActive,
  elapsed,
  open,
  onToggle,
}: {
  status: MatchStatus;
  currentPhase?: PhaseEvent;
  relayActive: boolean;
  elapsed: number;
  open: boolean;
  onToggle: () => void;
}) {
  if (status === "idle" || !currentPhase) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-cream/10 px-3 py-1 text-xs font-medium text-cream/70">
        Ready
      </span>
    );
  }
  const meta = PHASE_META[currentPhase.phase];
  const Icon = meta.icon;
  const isLoading = currentPhase.phase === "searching" || currentPhase.phase === "signaling" || currentPhase.phase === "media";
  return (
    <button
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-opacity hover:opacity-90 ${meta.color}`}
      title="Tap for connection timeline"
      aria-expanded={open}
    >
      {isLoading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Icon className="h-3 w-3" />
      )}
      <span>{meta.label}</span>
      {relayActive && currentPhase.phase !== "relay" && (
        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[10px] text-amber-200">
          <Shuffle className="h-2.5 w-2.5" />
        </span>
      )}
      <span className="tabular-nums text-[10px] opacity-70">{formatElapsed(elapsed)}</span>
      {open ? <ChevronUp className="h-3 w-3 opacity-70" /> : <ChevronDown className="h-3 w-3 opacity-70" />}
    </button>
  );
}

function PhaseTimeline({
  phases,
  now,
  onClose,
}: {
  phases: PhaseEvent[];
  now: number;
  onClose: () => void;
}) {
  const start = phases[0]?.at ?? now;
  return (
    <div className="border-b border-cream/10 bg-deep/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-start gap-3">
        <div className="flex-1">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-cream/60">
              Connection timeline
            </h4>
            <button
              onClick={onClose}
              aria-label="Close timeline"
              className="rounded-full p-1 text-cream/60 hover:bg-cream/10 hover:text-cream"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <ol className="space-y-1.5">
            {phases.map((p, i) => {
              const meta = PHASE_META[p.phase];
              const Icon = meta.icon;
              const next = phases[i + 1]?.at ?? now;
              const dur = Math.max(0, Math.round((next - p.at) / 100) / 10);
              const offset = Math.max(0, Math.round((p.at - start) / 100) / 10);
              return (
                <li key={p.id} className="flex items-center gap-3 text-xs">
                  <span className="w-16 shrink-0 tabular-nums text-cream/45">
                    +{offset.toFixed(1)}s
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.color}`}
                  >
                    <Icon className="h-3 w-3" />
                    {meta.label}
                  </span>
                  {p.detail && (
                    <span className="truncate text-cream/65">{p.detail}</span>
                  )}
                  <span className="ml-auto tabular-nums text-cream/40">
                    {formatTime(p.at)} · {dur.toFixed(1)}s
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}

function ControlBtn({
  children,
  onClick,
  label,
  active,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`grid h-12 w-12 place-items-center rounded-full transition-transform hover:scale-110 active:scale-95 ${
        className || (active ? "bg-cream text-deep" : "bg-cream/10 text-cream")
      }`}
    >
      {children}
    </button>
  );
}

function Overlay({
  status,
  statusInfo,
  onStart,
}: {
  status: MatchStatus;
  statusInfo?: string;
  onStart: () => void;
}) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-hero">
      <div className="mx-auto max-w-md px-6 text-center">
        {status === "idle" && (
          <>
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-teal-grad shadow-glow animate-pulse-ring">
              <VideoIcon className="h-9 w-9 text-white" />
            </div>
            <h1 className="mt-6 font-display text-3xl font-bold text-cream">Ready to meet someone?</h1>
            <p className="mt-2 text-sm text-cream/70">
              By tapping Start, you confirm you're 18+ and agree to keep things respectful.
            </p>
            <Button onClick={onStart} variant="hero" size="xl" className="mt-7">
              Start chatting
            </Button>
            <p className="mt-4 text-xs text-cream/50">No login. No tracking. P2P video.</p>
          </>
        )}
        {status === "requesting-media" && (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-teal-soft" />
            <h2 className="mt-4 font-display text-xl font-semibold text-cream">
              Asking for camera + mic…
            </h2>
            <p className="mt-1 text-sm text-cream/65">
              Allow access in your browser to continue.
            </p>
          </>
        )}
        {status === "searching" && (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-teal-soft" />
            <h2 className="mt-4 font-display text-xl font-semibold text-cream">
              Searching for someone new…
            </h2>
            <p className="mt-1 text-sm text-cream/65">
              {statusInfo ?? "Usually under 5 seconds."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function ReportDialog({
  open,
  onOpenChange,
  reporter,
  reported,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  reporter: string;
  reported: string | null;
  onSubmitted: () => void;
}) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!reason) {
      toast.error("Please pick a reason");
      return;
    }
    if (!reported) {
      toast.warning("No active stranger to report");
      onOpenChange(false);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("reports").insert({
      reporter_session: reporter,
      reported_session: reported,
      reason,
      details: details.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Failed to send report");
      return;
    }
    toast.success("Report sent. Disconnecting…");
    onOpenChange(false);
    setReason("");
    setDetails("");
    onSubmitted();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report stranger</DialogTitle>
          <DialogDescription>
            Reports are anonymous. Repeat offenders are banned automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger><SelectValue placeholder="Pick a reason" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nudity">Nudity / sexual content</SelectItem>
              <SelectItem value="harassment">Harassment or hate speech</SelectItem>
              <SelectItem value="minor">Appears to be a minor</SelectItem>
              <SelectItem value="spam">Spam or scam</SelectItem>
              <SelectItem value="violence">Violence or threats</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            placeholder="Add details (optional)"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={500}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={submit} disabled={submitting}>
            {submitting ? "Sending…" : "Submit & disconnect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
