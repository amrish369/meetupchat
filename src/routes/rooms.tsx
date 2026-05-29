import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Hash, Loader2, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/rooms")({
  head: () => ({
    meta: [
      { title: "Community Rooms — Meetup Live" },
      { name: "description", content: "Join public chat rooms — India, Coding, Study, Anime, Cricket and more." },
    ],
  }),
  component: RoomsPage,
});

interface Room {
  id: string; slug: string; name: string; description: string | null;
  category: string | null; emoji: string | null;
}

function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void supabase.from("rooms").select("*").order("is_official", { ascending: false }).order("name").then(({ data }) => {
      setRooms((data as Room[]) ?? []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
        <div className="mt-4">
          <h1 className="text-4xl font-bold flex items-center gap-2"><MessageCircle className="h-9 w-9 text-teal-400" /> Community Rooms</h1>
          <p className="mt-2 text-muted-foreground">Public chat rooms — meet people with shared interests.</p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {rooms.map(r => (
            <Link
              key={r.id}
              to="/rooms/$slug"
              params={{ slug: r.slug }}
              className="group rounded-3xl border border-border bg-card p-5 hover:border-teal-500/50 hover:shadow-lg transition"
            >
              <div className="flex items-start gap-4">
                <div className="text-4xl">{r.emoji ?? "💬"}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold group-hover:text-teal-400 transition">{r.name}</h3>
                    {r.category && <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{r.category}</span>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>
                  <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1"><Hash className="h-3 w-3" />{r.slug}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
