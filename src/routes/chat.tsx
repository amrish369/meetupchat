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
import { filterMessage } from "@/lib/profanity";
import { supabase } from "@/integrations/supabase/client";

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
  component: ChatRoom,
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
    await m.start();
  }, [sessionId, pushPhase]);

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
    const check = filterMessage(text);
    if (!check.ok) {
      toast.warning(check.reason ?? "Message blocked");
      return;
    }
    const ok = matcherRef.current?.sendMessage(check.clean) ?? false;
    if (!ok) toast.error("Not connected to anyone yet");
    setInput("");
  }, [input]);

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

      {timelineOpen && phases.length > 0 && (
        <PhaseTimeline phases={phases} now={now} onClose={() => setTimelineOpen(false)} />
      )}

      <main className="flex flex-1 min-h-0 flex-col lg:flex-row">
        <section className="relative flex-1 min-h-0 bg-black">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="h-full w-full object-cover"
          />
          {(status === "idle" || status === "searching" || status === "requesting-media") && (
            <Overlay status={status} statusInfo={statusInfo} onStart={start} />
          )}

          {status !== "idle" && (
            <div className="pointer-events-none absolute right-3 top-3 aspect-[3/4] w-28 overflow-hidden rounded-xl border-2 border-cream/20 bg-deep shadow-elev sm:w-36">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />
              {camOff && (
                <div className="absolute inset-0 grid place-items-center bg-deep/90">
                  <VideoOff className="h-6 w-6 text-cream/60" />
                </div>
              )}
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
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-gradient-to-t from-black/70 to-transparent p-4 sm:gap-3">
              <ControlBtn label={muted ? "Unmute" : "Mute"} onClick={toggleMic} active={!muted}>
                {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </ControlBtn>
              <ControlBtn label={camOff ? "Camera on" : "Camera off"} onClick={toggleCam} active={!camOff}>
                {camOff ? <VideoOff className="h-5 w-5" /> : <VideoIcon className="h-5 w-5" />}
              </ControlBtn>
              <button
                onClick={skip}
                className="flex h-14 items-center gap-2 rounded-full bg-teal-grad px-6 font-semibold text-white shadow-glow transition-transform hover:scale-105 active:scale-95"
              >
                <SkipForward className="h-5 w-5" /> Next
              </button>
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

function StatusPill({ status }: { status: MatchStatus }) {
  const map: Record<MatchStatus, { label: string; color: string; icon?: typeof Wifi }> = {
    idle: { label: "Ready", color: "bg-cream/10 text-cream/70" },
    "requesting-media": { label: "Camera…", color: "bg-cream/10 text-cream/70", icon: Loader2 },
    searching: { label: "Searching", color: "bg-teal/20 text-teal-soft", icon: Loader2 },
    connecting: { label: "Connecting", color: "bg-teal/20 text-teal-soft", icon: Loader2 },
    connected: { label: "Live", color: "bg-success/20 text-success" },
    disconnected: { label: "Disconnected", color: "bg-destructive/20 text-destructive" },
    error: { label: "Error", color: "bg-destructive/20 text-destructive" },
  };
  const it = map[status];
  const Icon = it.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${it.color}`}>
      {Icon && <Icon className="h-3 w-3 animate-spin" />}
      {it.label}
    </span>
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
