import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, ArrowLeft, Send, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { filterMessage } from "@/lib/profanity";

export const Route = createFileRoute("/messages/$peerId")({
  head: () => ({ meta: [{ title: "Chat — Meetup Live" }] }),
  component: DMPage,
});

interface Msg { id: string; sender_id: string; receiver_id: string; text: string; created_at: string; }
interface Peer { user_id: string; display_name: string | null; username: string | null; avatar_url: string | null; }

function DMPage() {
  const { peerId } = Route.useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [peer, setPeer] = useState<Peer | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);

  useEffect(() => {
    if (!user || !peerId) return;
    (async () => {
      const [{ data: prof }, { data: m }] = await Promise.all([
        supabase.rpc("public_profile", { p_user_id: peerId }),
        supabase.from("friend_messages").select("*")
          .or(`and(sender_id.eq.${user.id},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${user.id})`)
          .order("created_at", { ascending: true }).limit(200),
      ]);
      const row = Array.isArray(prof) ? prof[0] : prof;
      if (!row) { toast.error("User not found"); nav({ to: "/messages" }); return; }
      setPeer(row as Peer);
      setMsgs((m ?? []) as Msg[]);
      // mark as read
      await supabase.from("friend_messages").update({ read_at: new Date().toISOString() })
        .eq("receiver_id", user.id).eq("sender_id", peerId).is("read_at", null);
      setBusy(false);
    })();
  }, [user?.id, peerId, nav]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`dm:${peerId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "friend_messages" }, (payload) => {
        const m = payload.new as Msg;
        if ((m.sender_id === user.id && m.receiver_id === peerId) || (m.sender_id === peerId && m.receiver_id === user.id)) {
          setMsgs(prev => [...prev, m]);
          if (m.receiver_id === user.id) {
            void supabase.from("friend_messages").update({ read_at: new Date().toISOString() }).eq("id", m.id);
          }
        }
      }).subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user?.id, peerId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  const send = async () => {
    if (!user || !text.trim()) return;
    const f = filterMessage(text.trim());
    if (!f.ok) { toast.error(f.reason ?? "Message blocked"); return; }
    setText("");
    const { error } = await supabase.from("friend_messages").insert({ sender_id: user.id, receiver_id: peerId, text: f.clean.slice(0, 1000) });
    if (error) toast.error(error.message);
  };

  if (loading || busy || !peer) return <div className="min-h-screen grid place-items-center text-muted-foreground"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center gap-3">
          <Link to="/messages" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
          <Link to="/u/$userId" params={{ userId: peer.user_id }} className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-9 w-9 rounded-full overflow-hidden bg-secondary grid place-items-center shrink-0">
              {peer.avatar_url ? <img src={peer.avatar_url} alt="" className="h-full w-full object-cover" /> : <span className="font-bold text-sm">{(peer.display_name || "?")[0]}</span>}
            </div>
            <div className="min-w-0">
              <p className="font-semibold truncate">{peer.display_name || "User"}</p>
              {peer.username && <p className="text-xs text-muted-foreground truncate">@{peer.username}</p>}
            </div>
          </Link>
          <Link to="/shop" search={{ to: peer.user_id } as never}>
            <Button size="icon" variant="ghost"><Gift className="h-5 w-5" /></Button>
          </Link>
        </div>
      </div>

      <div className="flex-1 mx-auto max-w-2xl w-full px-4 py-4 space-y-2 overflow-y-auto">
        {msgs.length === 0 && <p className="text-center text-sm text-muted-foreground py-12">Say hi 👋</p>}
        {msgs.map(m => {
          const mine = m.sender_id === user!.id;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${mine ? 'bg-teal text-white' : 'bg-secondary'}`}>
                <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p>
                <p className={`text-[10px] mt-1 ${mine ? 'text-white/70' : 'text-muted-foreground'}`}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-0 border-t bg-background">
        <div className="mx-auto max-w-2xl px-4 py-3 flex gap-2">
          <Input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Message..." maxLength={1000} />
          <Button onClick={send} disabled={!text.trim()}><Send className="h-4 w-4" /></Button>
        </div>
      </div>
      <Toaster />
    </div>
  );
}
