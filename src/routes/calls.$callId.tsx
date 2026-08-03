import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, PhoneOff, Video as VideoIcon, VideoOff, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PrivateCall, type CallStatus, type CallMode } from "@/lib/private-call";

export const Route = createFileRoute("/calls/$callId")({
  head: () => ({ meta: [{ title: "Call — Meetup" }] }),
  component: CallScreen,
});

interface CallRow {
  id: string; caller_id: string; callee_id: string;
  room_id: string; mode: CallMode; status: string;
}
interface PeerProfile { display_name: string | null; avatar_url: string | null; username: string | null; }

function CallScreen() {
  const { callId } = Route.useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [row, setRow] = useState<CallRow | null>(null);
  const [peer, setPeer] = useState<PeerProfile | null>(null);
  const [status, setStatus] = useState<CallStatus>("idle");
  const [statusInfo, setStatusInfo] = useState<string>("");
  const [waiting, setWaiting] = useState(true);
  const [failed, setFailed] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const engineRef = useRef<PrivateCall | null>(null);
  const startedRef = useRef(false);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);

  // Load call row
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase.from("private_calls").select("*").eq("id", callId).maybeSingle();
      if (error || !data) { toast.error("Call not found"); nav({ to: "/calls" }); return; }
      setRow(data as CallRow);
      const peerId = data.caller_id === user.id ? data.callee_id : data.caller_id;
      const { data: prof } = await supabase.rpc("public_profile", { p_user_id: peerId });
      const p = Array.isArray(prof) ? prof[0] : prof;
      if (p) setPeer({ display_name: p.display_name, avatar_url: p.avatar_url, username: p.username });
    })();
  }, [callId, user?.id]);

  // Subscribe to status changes (declined / ended)
  useEffect(() => {
    if (!row) return;
    const ch = supabase
      .channel(`pc-row:${row.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "private_calls", filter: `id=eq.${row.id}` }, (payload) => {
        const next = payload.new as CallRow;
        setRow(next);
        if (next.status === "declined") {
          toast.info("Call declined");
          void cleanup(); nav({ to: "/calls" });
        } else if (next.status === "ended" || next.status === "missed") {
          toast.info("Call ended");
          void cleanup(); nav({ to: "/" });
        } else if (next.status === "accepted") {
          setWaiting(false);
        }
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [row?.id]);

  // Start engine once we know the call + we are accepted (or caller waiting)
  useEffect(() => {
    if (!user || !row || startedRef.current) return;
    const isCaller = row.caller_id === user.id;
    // Callee landing here means accepted; caller waits for accept then can also start media early
    if (row.status !== "ringing" && row.status !== "accepted") return;
    if (isCaller && row.status === "ringing") {
      setWaiting(true);
      return;
    }
    if (!isCaller && row.status === "ringing") {
      // Shouldn't reach here without accepting; ignore
      return;
    }
    startedRef.current = true;
    setWaiting(false);
    const engine = new PrivateCall({
      userId: user.id,
      roomId: row.room_id,
      isCaller,
      mode: row.mode,
      cb: {
        onStatus: (s, info) => { setStatus(s); if (info) setStatusInfo(info); },
        onLocalStream: (s) => {
          if (localRef.current) {
            localRef.current.srcObject = s;
            if (s) void localRef.current.play().catch(() => {});
          }
        },
        onRemoteStream: (s) => {
          if (remoteRef.current) {
            remoteRef.current.srcObject = s;
            if (s) void remoteRef.current.play().catch(() => {});
          }
        },
        onPeerLeft: () => { toast.info("Peer left"); },
      },
    });
    engineRef.current = engine;
    void engine.start();
  }, [user?.id, row?.id, row?.status]);

  // Caller: when row updates to accepted, start engine
  useEffect(() => {
    if (!user || !row || startedRef.current) return;
    if (row.caller_id === user.id && row.status === "accepted") {
      startedRef.current = true;
      setWaiting(false);
      const engine = new PrivateCall({
        userId: user.id,
        roomId: row.room_id,
        isCaller: true,
        mode: row.mode,
        cb: {
          onStatus: (s, info) => { setStatus(s); if (info) setStatusInfo(info); },
          onLocalStream: (s) => {
            if (localRef.current) {
              localRef.current.srcObject = s;
              if (s) void localRef.current.play().catch(() => {});
            }
          },
          onRemoteStream: (s) => {
            if (remoteRef.current) {
              remoteRef.current.srcObject = s;
              if (s) void remoteRef.current.play().catch(() => {});
            }
          },
          onPeerLeft: () => { toast.info("Peer left"); },
        },
      });
      engineRef.current = engine;
      void engine.start();
    }
  }, [row?.status, user?.id]);

  const cleanup = async () => {
    if (engineRef.current) { await engineRef.current.stop(); engineRef.current = null; }
  };

  const hangup = async () => {
    if (row) await supabase.rpc("end_private_call", { p_call_id: row.id });
    await cleanup();
    nav({ to: "/calls" });
  };

  useEffect(() => () => { void cleanup(); }, []);

  // Caller-side timeout: 35s ringing → cancel
  useEffect(() => {
    if (!row || row.status !== "ringing" || row.caller_id !== user?.id) return;
    const t = setTimeout(() => {
      if (row.status === "ringing") {
        void supabase.rpc("end_private_call", { p_call_id: row.id });
        toast.info("No answer");
      }
    }, 35_000);
    return () => clearTimeout(t);
  }, [row?.status, row?.id, user?.id]);

  // Realtime safety net: poll the call row while it is still ringing, so a
  // dropped websocket can't leave the caller stuck on "Ringing…".
  useEffect(() => {
    if (!row || row.status !== "ringing") return;
    const t = setInterval(async () => {
      const { data } = await supabase.from("private_calls").select("*").eq("id", row.id).maybeSingle();
      if (!data) return;
      const next = data as CallRow;
      if (next.status === row.status) return;
      setRow(next);
      if (next.status === "declined") { toast.info("Call declined"); void cleanup(); nav({ to: "/calls" }); }
      else if (next.status === "ended" || next.status === "missed") { toast.info("Call ended"); void cleanup(); nav({ to: "/" }); }
      else if (next.status === "accepted") setWaiting(false);
    }, 3000);
    return () => clearInterval(t);
  }, [row?.id, row?.status]);

  // Surface a real failure instead of an endless spinner.
  useEffect(() => {
    if (waiting || status === "connected" || status === "ended") { setFailed(false); return; }
    if (status !== "connecting" && status !== "requesting-media") return;
    const t = setTimeout(() => setFailed(true), 20_000);
    return () => clearTimeout(t);
  }, [status, waiting]);

  const isVideo = row?.mode === "video";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <Toaster />
      {/* Remote */}
      <div className="relative flex-1 overflow-hidden">
        {isVideo ? (
          <video
            ref={remoteRef}
            className="absolute inset-0 h-full w-full object-cover"
            playsInline autoPlay
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-slate-900 to-black">
            {peer?.avatar_url ? (
              <img src={peer.avatar_url} alt="" className="h-32 w-32 rounded-full object-cover" />
            ) : (
              <div className="grid h-32 w-32 place-items-center rounded-full bg-white/10 text-4xl font-bold">
                {(peer?.display_name || "?").charAt(0).toUpperCase()}
              </div>
            )}
            <audio ref={remoteRef as unknown as React.RefObject<HTMLAudioElement>} autoPlay />
          </div>
        )}

        {/* Top overlay */}
        <div className="absolute inset-x-0 top-0 z-10 flex flex-col items-center gap-1 bg-gradient-to-b from-black/60 to-transparent px-4 py-4 pt-6">
          <p className="text-lg font-semibold">{peer?.display_name || "Connecting…"}</p>
          <p className="text-xs text-white/70">
            {waiting && row?.caller_id === user?.id ? "Ringing…" : statusLabel(status, statusInfo)}
          </p>
        </div>

        {/* Local PiP */}
        {isVideo && (
          <div className="absolute right-3 top-20 z-10 h-40 w-28 overflow-hidden rounded-lg border-2 border-white/20 bg-black shadow-lg">
            <video
              ref={localRef}
              className="h-full w-full object-cover [transform:scaleX(-1)]"
              playsInline autoPlay muted
            />
          </div>
        )}

        {!failed && (waiting || status === "requesting-media" || status === "connecting") && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-white/70" />
          </div>
        )}

        {failed && status !== "connected" && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/80 px-8 text-center">
            <p className="text-base font-semibold">Connection failed</p>
            <p className="text-sm text-white/70">
              Aapka network is call ko block kar raha hai. Wi-Fi par try karein ya dobara koshish karein.
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => { setFailed(false); window.location.reload(); }}>Retry</Button>
              <Button variant="destructive" onClick={hangup}>End</Button>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="z-10 flex items-center justify-center gap-4 bg-black/80 px-4 py-6 pb-8">
        <Button
          size="icon" variant={micOn ? "secondary" : "destructive"}
          className="h-14 w-14 rounded-full"
          onClick={() => { setMicOn(!micOn); engineRef.current?.toggleAudio(!micOn); }}
          aria-label="Toggle mic"
        >
          {micOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
        </Button>

        {isVideo && (
          <Button
            size="icon" variant={camOn ? "secondary" : "destructive"}
            className="h-14 w-14 rounded-full"
            onClick={() => { setCamOn(!camOn); engineRef.current?.toggleVideo(!camOn); }}
            aria-label="Toggle camera"
          >
            {camOn ? <VideoIcon className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
          </Button>
        )}

        {isVideo && (
          <Button
            size="icon" variant="secondary"
            className="h-14 w-14 rounded-full"
            onClick={async () => {
              try { await engineRef.current?.switchCamera(); }
              catch (e) { toast.error((e as Error).message); }
            }}
            aria-label="Flip camera"
          >
            <RefreshCcw className="h-6 w-6" />
          </Button>
        )}

        <Button
          size="icon" variant="destructive"
          className="h-16 w-16 rounded-full"
          onClick={hangup}
          aria-label="End call"
        >
          <PhoneOff className="h-7 w-7" />
        </Button>
      </div>
    </div>
  );
}

function statusLabel(s: CallStatus, info: string) {
  if (info) return info;
  switch (s) {
    case "requesting-media": return "Camera/mic activate ho raha…";
    case "connecting": return "Connecting…";
    case "connected": return "Connected";
    case "ended": return "Call ended";
    case "error": return "Error";
    default: return "";
  }
}
