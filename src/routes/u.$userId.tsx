import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Coins, Flame, Loader2, ShieldCheck, UserMinus, UserPlus, Ban, MessageCircle, Gift, Phone, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/u/$userId")({
  head: () => ({ meta: [{ title: "Profile — Meetup Live" }] }),
  component: PublicProfilePage,
});

interface PubProfile {
  user_id: string; display_name: string | null; username: string | null;
  bio: string | null; avatar_url: string | null; interests: string[];
  region: string | null; is_premium: boolean; coins: number;
  streak_days: number; trust_score: number; created_at: string;
}

function PublicProfilePage() {
  const { userId } = Route.useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [p, setP] = useState<PubProfile | null>(null);
  const [busy, setBusy] = useState(true);
  const [following, setFollowing] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  useEffect(() => {
    if (!user || !userId) return;
    setBusy(true);
    (async () => {
      const [{ data: prof }, { data: f }, { data: b }] = await Promise.all([
        supabase.rpc("public_profile", { p_user_id: userId }),
        supabase.from("follows").select("followee_id").eq("follower_id", user.id).eq("followee_id", userId).maybeSingle(),
        supabase.from("blocks").select("blocked_id").eq("blocker_id", user.id).eq("blocked_id", userId).maybeSingle(),
      ]);
      const row = Array.isArray(prof) ? prof[0] : prof;
      if (!row) { toast.error("Profile not found"); nav({ to: "/" }); return; }
      setP(row as PubProfile);
      setFollowing(!!f);
      setBlocked(!!b);
      if (user.id !== userId) {
        void supabase.rpc("record_profile_visit", { p_profile_id: userId });
      }
      setBusy(false);
    })();
  }, [user?.id, userId, nav]);

  const toggleFollow = async () => {
    if (!user || !p) return;
    if (following) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("followee_id", p.user_id);
      setFollowing(false); toast.success("Unfollowed");
    } else {
      const { error } = await supabase.from("follows").insert({ follower_id: user.id, followee_id: p.user_id });
      if (error) { toast.error(error.message); return; }
      setFollowing(true); toast.success("Following!");
    }
  };

  const toggleBlock = async () => {
    if (!user || !p) return;
    if (blocked) {
      await supabase.from("blocks").delete().eq("blocker_id", user.id).eq("blocked_id", p.user_id);
      setBlocked(false); toast.success("Unblocked");
    } else {
      const { error } = await supabase.from("blocks").insert({ blocker_id: user.id, blocked_id: p.user_id });
      if (error) { toast.error(error.message); return; }
      setBlocked(true); toast.success("Blocked");
    }
  };

  const startCall = async (mode: "video" | "audio") => {
    if (!user || !p) return;
    const { data, error } = await supabase.rpc("start_private_call", { p_callee: p.user_id, p_mode: mode });
    if (error) { toast.error(error.message.includes("mutual") ? "You and this user need to follow each other." : error.message); return; }
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.id) nav({ to: "/calls/$callId", params: { callId: row.id } });
  };

  if (loading || busy || !p) return <div className="min-h-screen grid place-items-center text-muted-foreground"><Loader2 className="animate-spin" /></div>;

  const isSelf = user?.id === p.user_id;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Link to="/leaderboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <div className="mt-6 rounded-3xl border border-border bg-card p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="h-24 w-24 rounded-full overflow-hidden bg-secondary border-4 border-teal-500/30">
              {p.avatar_url ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover" /> :
                <div className="h-full w-full grid place-items-center text-3xl font-bold">{(p.display_name || "?")[0]}</div>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold">{p.display_name || p.username || "User"}</h1>
                {p.is_premium && <Badge className="bg-teal-600 text-white"><ShieldCheck className="mr-1 h-3 w-3" /> Premium</Badge>}
              </div>
              {p.username && <p className="text-sm text-muted-foreground">@{p.username}</p>}
              {p.region && <p className="mt-1 text-sm text-muted-foreground">📍 {p.region}</p>}
              {p.bio && <p className="mt-3 text-sm">{p.bio}</p>}
            </div>
          </div>

          {!isSelf && (
            <div className="mt-5 space-y-2">
              <div className="flex gap-2">
                <Button onClick={toggleFollow} variant={following ? "outline" : "default"} className="flex-1">
                  {following ? <><UserMinus className="h-4 w-4 mr-2" /> Unfollow</> : <><UserPlus className="h-4 w-4 mr-2" /> Follow</>}
                </Button>
                <Button onClick={toggleBlock} variant={blocked ? "outline" : "secondary"}>
                  <Ban className="h-4 w-4 mr-2" /> {blocked ? "Unblock" : "Block"}
                </Button>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="hero" className="flex-1">
                  <Link to="/messages/$peerId" params={{ peerId: p.user_id }}>
                    <MessageCircle className="h-4 w-4 mr-2" /> Message
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/shop" search={{ to: p.user_id } as never}>
                    <Gift className="h-4 w-4 mr-2" /> Gift
                  </Link>
                </Button>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => startCall("audio")} variant="outline" className="flex-1">
                  <Phone className="h-4 w-4 mr-2" /> Voice call
                </Button>
                <Button onClick={() => startCall("video")} variant="outline" className="flex-1">
                  <Video className="h-4 w-4 mr-2" /> Video call
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <Stat icon={<Coins className="text-amber-400" />} label="Coins" value={p.coins} />
          <Stat icon={<Flame className="text-orange-500" />} label="Streak" value={p.streak_days} />
          <Stat icon={<ShieldCheck className="text-teal-400" />} label="Trust" value={p.trust_score} />
        </div>

        {p.interests?.length > 0 && (
          <div className="mt-6 rounded-3xl border border-border bg-card p-6">
            <h2 className="font-semibold mb-3">Interests</h2>
            <div className="flex flex-wrap gap-2">
              {p.interests.map(i => <Badge key={i} variant="secondary">{i}</Badge>)}
            </div>
          </div>
        )}
      </div>
      <Toaster />
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-center">
      <div className="mx-auto h-6 w-6">{icon}</div>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
