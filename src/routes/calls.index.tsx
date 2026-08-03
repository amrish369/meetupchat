import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Phone, Video, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/calls/")({
  head: () => ({ meta: [{ title: "Private Calls — Meetup" }] }),
  component: CallsPage,
});

interface Friend {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

function CallsPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [busy, setBusy] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase.rpc("mutual_followers");
      if (error) toast.error(error.message);
      setFriends((data ?? []) as Friend[]);
      setBusy(false);
    })();
  }, [user?.id]);

  const startCall = async (peer: Friend, mode: "video" | "audio") => {
    setStarting(peer.user_id + mode);
    const { data, error } = await supabase.rpc("start_private_call", {
      p_callee: peer.user_id,
      p_mode: mode,
    });
    setStarting(null);
    if (error) { toast.error(error.message); return; }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.id) { toast.error("Failed to start call"); return; }
    nav({ to: "/calls/$callId", params: { callId: row.id } });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Toaster />
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 px-4 py-3 backdrop-blur border-b">
        <Link to="/" className="rounded-full p-1.5 hover:bg-muted"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="text-lg font-bold">Private Calls</h1>
      </div>

      <div className="px-4 py-3 text-xs text-muted-foreground">
        Aap sirf un users ko call kar sakte hain jo aapko follow karte hain aur jinhe aap follow karte hain (mutual follow).
      </div>

      {busy ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : friends.length === 0 ? (
        <div className="mx-4 mt-8 rounded-xl border border-dashed p-8 text-center">
          <UserPlus className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium">No mutual followers yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Follow karein aur unhe bhi follow karne ke liye kahein.</p>
          <Button asChild className="mt-4" size="sm"><Link to="/leaderboard">Explore users</Link></Button>
        </div>
      ) : (
        <ul className="divide-y">
          {friends.map((f) => (
            <li key={f.user_id} className="flex items-center gap-3 px-4 py-3">
              <Link to="/u/$userId" params={{ userId: f.user_id }} className="flex flex-1 items-center gap-3">
                {f.avatar_url ? (
                  <img src={f.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-secondary text-sm font-semibold">
                    {(f.display_name || f.username || "?").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{f.display_name || "User"}</p>
                  {f.username && <p className="truncate text-xs text-muted-foreground">@{f.username}</p>}
                </div>
              </Link>
              <Button
                size="icon" variant="outline"
                disabled={starting === f.user_id + "audio"}
                onClick={() => startCall(f, "audio")}
                aria-label="Audio call"
              >
                {starting === f.user_id + "audio" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
              </Button>
              <Button
                size="icon"
                disabled={starting === f.user_id + "video"}
                onClick={() => startCall(f, "video")}
                aria-label="Video call"
              >
                {starting === f.user_id + "video" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
