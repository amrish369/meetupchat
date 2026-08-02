import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2, MessageCircle, Phone, Video, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface FriendRow {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  last_text?: string | null;
  last_at?: string | null;
  unread?: number;
}

/** Mutual-follow friends list with WhatsApp-style chat + call actions. */
export function FriendsList() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<FriendRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [mutuals, convos] = await Promise.all([
        supabase.rpc("mutual_followers"),
        supabase.rpc("friend_conversations"),
      ]);
      if (cancelled) return;
      if (mutuals.error) toast.error(mutuals.error.message);
      const convoMap = new Map<string, { last_text: string | null; last_at: string | null; unread: number }>();
      for (const c of (convos.data ?? []) as any[]) {
        convoMap.set(c.peer_id, { last_text: c.last_text, last_at: c.last_at, unread: c.unread ?? 0 });
      }
      const list = ((mutuals.data ?? []) as any[]).map((m) => ({
        user_id: m.user_id,
        display_name: m.display_name,
        username: m.username,
        avatar_url: m.avatar_url,
        ...(convoMap.get(m.user_id) ?? { last_text: null, last_at: null, unread: 0 }),
      })) as FriendRow[];
      list.sort((a, b) => {
        if ((b.unread ?? 0) !== (a.unread ?? 0)) return (b.unread ?? 0) - (a.unread ?? 0);
        return new Date(b.last_at ?? 0).getTime() - new Date(a.last_at ?? 0).getTime();
      });
      setRows(list);
      setBusy(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const startCall = async (peer: FriendRow, mode: "video" | "audio") => {
    setStarting(peer.user_id + mode);
    const { data, error } = await supabase.rpc("start_private_call", { p_callee: peer.user_id, p_mode: mode });
    setStarting(null);
    if (error) {
      toast.error(error.message.includes("mutual") ? "Mutual follow zaroori hai" : error.message);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.id) { toast.error("Call start nahi hui"); return; }
    nav({ to: "/calls/$callId", params: { callId: row.id } });
  };

  if (busy) {
    return <div className="grid place-items-center py-16 text-muted-foreground"><Loader2 className="animate-spin" /></div>;
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center">
        <Users className="mx-auto h-10 w-10 text-muted-foreground opacity-60" />
        <p className="mt-3 text-sm font-medium">Abhi koi friend nahi hai</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Jab aap aur koi user ek dusre ko follow karte hain, wo yahan aa jaate hain — phir private chat aur call unlock ho jaata hai.
        </p>
        <Button asChild size="sm" className="mt-4"><Link to="/leaderboard">Users explore karein</Link></Button>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((f) => (
        <li key={f.user_id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition hover:border-teal-500/50">
          <Link to="/messages/$peerId" params={{ peerId: f.user_id }} className="flex min-w-0 flex-1 items-center gap-3">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-secondary grid place-items-center">
              {f.avatar_url
                ? <img src={f.avatar_url} alt="" className="h-full w-full object-cover" />
                : <span className="text-sm font-bold">{(f.display_name || f.username || "?").charAt(0).toUpperCase()}</span>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{f.display_name || f.username || "User"}</p>
              <p className="truncate text-xs text-muted-foreground">
                {f.last_text || "Tap to start chatting"}
              </p>
            </div>
            {!!f.unread && (
              <span className="ml-1 grid h-5 min-w-5 place-items-center rounded-full bg-teal px-1.5 text-[11px] font-bold text-white">
                {f.unread}
              </span>
            )}
          </Link>
          <div className="flex shrink-0 gap-1">
            <Button asChild size="icon" variant="ghost" aria-label="Chat">
              <Link to="/messages/$peerId" params={{ peerId: f.user_id }}><MessageCircle className="h-4 w-4" /></Link>
            </Button>
            <Button size="icon" variant="ghost" aria-label="Voice call"
              disabled={starting === f.user_id + "audio"}
              onClick={() => startCall(f, "audio")}>
              {starting === f.user_id + "audio" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="ghost" aria-label="Video call"
              disabled={starting === f.user_id + "video"}
              onClick={() => startCall(f, "video")}>
              {starting === f.user_id + "video" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
