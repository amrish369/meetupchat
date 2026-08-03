import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, MessageCircle, ArrowLeft, PenSquare, Search, X } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/messages/")({
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

interface Recipient {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  relation: string;
}

function MessagesPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [convos, setConvos] = useState<Convo[]>([]);
  const [busy, setBusy] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [recipientsBusy, setRecipientsBusy] = useState(false);
  const [q, setQ] = useState("");

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

  const openPicker = async () => {
    setPickerOpen(true);
    if (recipients.length === 0) {
      setRecipientsBusy(true);
      const { data } = await supabase.rpc("gift_recipients");
      setRecipients((data ?? []) as Recipient[]);
      setRecipientsBusy(false);
    }
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return recipients;
    return recipients.filter(r =>
      (r.display_name || "").toLowerCase().includes(s) ||
      (r.username || "").toLowerCase().includes(s)
    );
  }, [recipients, q]);

  if (loading || busy) return <div className="min-h-screen grid place-items-center text-muted-foreground"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Link to="/friends" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Friends
        </Link>
        <div className="mt-4 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Messages</h1>
          <Button onClick={openPicker} variant="hero" size="sm"><PenSquare className="h-4 w-4 mr-2" /> New</Button>
        </div>

        <div className="mt-6 space-y-2">
          {convos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
              <MessageCircle className="mx-auto h-10 w-10 opacity-60" />
              <p className="mt-2 text-sm">No conversations yet. Tap <strong>New</strong> to start one.</p>
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

      {pickerOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setPickerOpen(false)}>
          <div className="w-full sm:max-w-md bg-card border border-border rounded-t-3xl sm:rounded-3xl p-5 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-lg">Start a new chat</h2>
              <button onClick={() => setPickerOpen(false)} className="text-muted-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search followers / following..." className="pl-9" />
            </div>
            <div className="mt-3 overflow-y-auto flex-1 space-y-1">
              {recipientsBusy ? (
                <div className="grid place-items-center py-10 text-muted-foreground"><Loader2 className="animate-spin" /></div>
              ) : filtered.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  {recipients.length === 0 ? "Follow someone first to start chatting." : "No matches."}
                </p>
              ) : filtered.map(r => (
                <Link key={r.user_id} to="/messages/$peerId" params={{ peerId: r.user_id }}
                  onClick={() => setPickerOpen(false)}
                  className="flex items-center gap-3 rounded-2xl p-2 hover:bg-secondary transition">
                  <div className="h-10 w-10 rounded-full overflow-hidden bg-secondary grid place-items-center shrink-0">
                    {r.avatar_url ? <img src={r.avatar_url} alt="" className="h-full w-full object-cover" /> : <span className="font-bold text-sm">{(r.display_name || "?")[0]}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{r.display_name || r.username || "User"}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.username ? `@${r.username}` : r.relation}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
      <Toaster />
    </div>
  );
}
