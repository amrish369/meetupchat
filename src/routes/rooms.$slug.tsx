import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { filterMessage } from "@/lib/profanity";

export const Route = createFileRoute("/rooms/$slug")({
  head: () => ({ meta: [{ title: "Room — Meetup Live" }] }),
  component: RoomPage,
});

interface Msg {
  id: string; room_id: string; user_id: string; display_name: string | null;
  text: string; created_at: string;
}

interface Room { id: string; slug: string; name: string; emoji: string | null; description: string | null }

function RoomPage() {
  const { slug } = Route.useParams();
  const { user, profile, loading } = useAuth();
  const nav = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: r } = await supabase.from("rooms").select("*").eq("slug", slug).maybeSingle();
      if (!r) { toast.error("Room not found"); nav({ to: "/rooms" }); return; }
      setRoom(r as Room);

      const { data: m } = await supabase.from("room_messages")
        .select("*").eq("room_id", (r as Room).id).order("created_at", { ascending: true }).limit(100);
      setMsgs((m as Msg[]) ?? []);

      channel = supabase.channel(`room:${(r as Room).id}`)
        .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${(r as Room).id}` },
          (payload) => setMsgs(prev => [...prev, payload.new as Msg])
        ).subscribe();
    })();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [slug, nav]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length]);

  const send = async () => {
    if (!user || !room || !text.trim()) return;
    const check = filterMessage(text.trim());
    if (!check.ok) { toast.error(check.reason || "Message blocked"); return; }
    const clean = check.clean.slice(0, 500);
    setSending(true);
    const { error } = await supabase.from("room_messages").insert({
      room_id: room.id, user_id: user.id,
      display_name: profile?.display_name || profile?.username || "Anon",
      text: clean,
    });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    setText("");
  };

  if (loading || !room) return <div className="min-h-screen grid place-items-center text-muted-foreground"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-3">
          <Link to="/rooms" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
          <div className="text-2xl">{room.emoji}</div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold truncate">{room.name}</h1>
            {room.description && <p className="text-xs text-muted-foreground truncate">{room.description}</p>}
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-4 space-y-3">
          {msgs.length === 0 && <p className="text-center text-muted-foreground py-12">Be the first to say hi 👋</p>}
          {msgs.map(m => {
            const mine = m.user_id === user?.id;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${mine ? "bg-teal-600 text-white" : "bg-secondary"}`}>
                  {!mine && <p className="text-xs font-semibold text-teal-400 mb-0.5">{m.display_name || "Anon"}</p>}
                  <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-border bg-background/90 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-3 flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            placeholder={`Message #${room.slug}`}
            maxLength={500}
            disabled={sending}
          />
          <Button onClick={send} disabled={sending || !text.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <Toaster />
    </div>
  );
}
