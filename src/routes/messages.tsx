import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, MessageCircle, ArrowLeft } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/messages")({
  head: () => ({ meta: [{ title: "Messages — Meetup Live" }] }),
  component: MessagesPage,
});

interface Convo {
  peer_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  last_text: string;
  last_at: string;
  unread: number;
}

function MessagesPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [convos, setConvos] = useState<Convo[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  const load = async () => {
    if (!user) return;
    setBusy(true);
    const { data } = await supabase.rpc("friend_conversations");
    setConvos((data ?? []) as Convo[]);
    setBusy(false);
  };

  useEffect(() => { void load(); }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("friend_messages_inbox")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "friend_messages", filter: `receiver_id=eq.${user.id}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user?.id]);

  if (loading || busy) return <div className="min-h-screen grid place-items-center text-muted-foreground"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Link to="/friends" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Friends
        </Link>
        <h1 className="mt-4 text-3xl font-bold">Messages</h1>

        <div className="mt-6 space-y-2">
          {convos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
              <MessageCircle className="mx-auto h-10 w-10 opacity-60" />
              <p className="mt-2 text-sm">No conversations yet. Open a profile to start chatting.</p>
            </div>
          ) : convos.map(c => (
            <Link key={c.peer_id} to="/messages/$peerId" params={{ peerId: c.peer_id }}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:border-teal-500/50 transition">
              <div className="h-12 w-12 rounded-full overflow-hidden bg-secondary grid place-items-center">
                {c.avatar_url ? <img src={c.avatar_url} alt="" className="h-full w-full object-cover" /> : <span className="font-bold">{(c.display_name || "?")[0]}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline gap-2">
                  <p className="font-medium truncate">{c.display_name || c.username || "User"}</p>
                  <span className="text-xs text-muted-foreground shrink-0">{new Date(c.last_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-sm text-muted-foreground truncate">{c.last_text}</p>
              </div>
              {c.unread > 0 && <span className="bg-teal text-white text-xs rounded-full h-5 min-w-5 px-1.5 grid place-items-center">{c.unread}</span>}
            </Link>
          ))}
        </div>
      </div>
      <Toaster />
    </div>
  );
}
