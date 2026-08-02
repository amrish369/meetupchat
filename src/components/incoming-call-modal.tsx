import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Phone, PhoneOff, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

interface IncomingCall {
  id: string; caller_id: string; callee_id: string;
  room_id: string; mode: "video" | "audio"; status: string;
}
interface CallerProfile { display_name: string | null; avatar_url: string | null; username: string | null; }

export function IncomingCallModal() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [caller, setCaller] = useState<CallerProfile | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) { setIncoming(null); return; }

    const handle = async (row: IncomingCall) => {
      if (row.callee_id !== user.id) return;
      if (row.status !== "ringing") return;
      setIncoming(row);
      const { data } = await supabase.rpc("public_profile", { p_user_id: row.caller_id });
      const p = Array.isArray(data) ? data[0] : data;
      if (p) setCaller({ display_name: p.display_name, avatar_url: p.avatar_url, username: p.username });
    };

    const ch = supabase
      .channel(`incoming-pc:${user.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "private_calls", filter: `callee_id=eq.${user.id}` },
        (payload) => handle(payload.new as IncomingCall))
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "private_calls", filter: `callee_id=eq.${user.id}` },
        (payload) => {
          const next = payload.new as IncomingCall;
          setIncoming((cur) => (cur && next.id === cur.id && next.status !== "ringing" ? null : cur));
        })

      .subscribe();

    // Also check on mount if there's a pending ringing call
    (async () => {
      const { data } = await supabase.from("private_calls")
        .select("*").eq("callee_id", user.id).eq("status", "ringing")
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (data) await handle(data as IncomingCall);
    })();

    return () => { void supabase.removeChannel(ch); };
  }, [user?.id]);

  const accept = async () => {
    if (!incoming) return;
    setBusy(true);
    const { error } = await supabase.rpc("respond_private_call", { p_call_id: incoming.id, p_accept: true });
    setBusy(false);
    if (error) return;
    const callId = incoming.id;
    setIncoming(null);
    nav({ to: "/calls/$callId", params: { callId } });
  };

  const decline = async () => {
    if (!incoming) return;
    setBusy(true);
    await supabase.rpc("respond_private_call", { p_call_id: incoming.id, p_accept: false });
    setIncoming(null);
    setBusy(false);
  };

  if (!incoming) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-gradient-to-b from-slate-900 via-black to-slate-900 px-6 py-12 text-white">
      <div className="flex flex-col items-center gap-4 pt-12">
        <p className="text-sm uppercase tracking-widest text-white/60">
          Incoming {incoming.mode} call
        </p>
        {caller?.avatar_url ? (
          <img src={caller.avatar_url} alt="" className="h-36 w-36 rounded-full object-cover ring-4 ring-white/20 animate-pulse" />
        ) : (
          <div className="grid h-36 w-36 place-items-center rounded-full bg-white/10 text-5xl font-bold ring-4 ring-white/20 animate-pulse">
            {(caller?.display_name || "?").charAt(0).toUpperCase()}
          </div>
        )}
        <p className="text-2xl font-bold">{caller?.display_name || "Someone"}</p>
        {caller?.username && <p className="text-sm text-white/60">@{caller.username}</p>}
        <div className="mt-2 flex items-center gap-2 text-xs text-white/70">
          {incoming.mode === "video" ? <Video className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
          <span>{incoming.mode === "video" ? "Video call" : "Voice call"}</span>
        </div>
      </div>

      <div className="flex w-full items-center justify-around pb-8">
        <button
          onClick={decline} disabled={busy}
          className="flex flex-col items-center gap-2"
          aria-label="Decline"
        >
          <span className="grid h-16 w-16 place-items-center rounded-full bg-red-600 shadow-lg active:scale-95">
            <PhoneOff className="h-7 w-7" />
          </span>
          <span className="text-xs">Decline</span>
        </button>
        <button
          onClick={accept} disabled={busy}
          className="flex flex-col items-center gap-2"
          aria-label="Accept"
        >
          <span className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500 shadow-lg active:scale-95">
            {incoming.mode === "video" ? <Video className="h-7 w-7" /> : <Phone className="h-7 w-7" />}
          </span>
          <span className="text-xs">Accept</span>
        </button>
      </div>
    </div>
  );
}
