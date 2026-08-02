import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Eye, Loader2, MessageCircle, UserMinus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { FriendsList } from "@/components/friends-list";

export const Route = createFileRoute("/friends")({
  head: () => ({
    meta: [
      { title: "Friends — private chat & calls | Meetup" },
      { name: "description", content: "Mutual followers ke saath private messages, voice call aur video call — sab ek jagah." },
      { property: "og:title", content: "Friends — private chat & calls | Meetup" },
      { property: "og:description", content: "Mutual followers ke saath private messages, voice call aur video call." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FriendsPage,
});


interface MiniProfile {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

function FriendsPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [following, setFollowing] = useState<MiniProfile[]>([]);
  const [followers, setFollowers] = useState<MiniProfile[]>([]);
  const [visitors, setVisitors] = useState<Array<MiniProfile & { visited_at: string }>>([]);
  const [blocked, setBlocked] = useState<MiniProfile[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  const load = async () => {
    if (!user) return;
    setBusy(true);

    const [followingRes, followersRes, visitorsRes, blocksRes] = await Promise.all([
      supabase.from("follows").select("followee_id").eq("follower_id", user.id),
      supabase.from("follows").select("follower_id").eq("followee_id", user.id),
      supabase.from("profile_visitors").select("visitor_id, visited_at").eq("profile_id", user.id).order("visited_at", { ascending: false }).limit(30),
      supabase.from("blocks").select("blocked_id").eq("blocker_id", user.id),
    ]);

    const fetchProfiles = async (ids: string[]): Promise<MiniProfile[]> => {
      if (ids.length === 0) return [];
      const results = await Promise.all(ids.map(id => supabase.rpc("public_profile", { p_user_id: id })));
      return results.map(r => (Array.isArray(r.data) ? r.data[0] : r.data)).filter(Boolean).map((p: any) => ({
        user_id: p.user_id, display_name: p.display_name, username: p.username, avatar_url: p.avatar_url,
      }));
    };

    const [fg, fr, vs, bl] = await Promise.all([
      fetchProfiles((followingRes.data ?? []).map((x: any) => x.followee_id)),
      fetchProfiles((followersRes.data ?? []).map((x: any) => x.follower_id)),
      (async () => {
        const rows = visitorsRes.data ?? [];
        const profs = await fetchProfiles(rows.map((x: any) => x.visitor_id));
        return rows.map((r: any) => {
          const p = profs.find(x => x.user_id === r.visitor_id);
          return p ? { ...p, visited_at: r.visited_at } : null;
        }).filter(Boolean) as Array<MiniProfile & { visited_at: string }>;
      })(),
      fetchProfiles((blocksRes.data ?? []).map((x: any) => x.blocked_id)),
    ]);

    setFollowing(fg); setFollowers(fr); setVisitors(vs); setBlocked(bl);
    setBusy(false);
  };

  useEffect(() => { void load(); }, [user?.id]);

  const unfollow = async (id: string) => {
    await supabase.from("follows").delete().eq("follower_id", user!.id).eq("followee_id", id);
    toast.success("Unfollowed");
    setFollowing(following.filter(f => f.user_id !== id));
  };

  const unblock = async (id: string) => {
    await supabase.from("blocks").delete().eq("blocker_id", user!.id).eq("blocked_id", id);
    toast.success("Unblocked");
    setBlocked(blocked.filter(b => b.user_id !== id));
  };

  if (loading || busy) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link to="/profile" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <h1 className="mt-4 text-3xl font-bold">Your network</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Friends = jinhe aap follow karte hain aur wo bhi aapko. Unke saath private chat aur call unlock rehta hai.
        </p>

        <Tabs defaultValue="friends" className="mt-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="friends">Friends</TabsTrigger>
            <TabsTrigger value="following">Following ({following.length})</TabsTrigger>
            <TabsTrigger value="followers">Followers ({followers.length})</TabsTrigger>
            <TabsTrigger value="visitors">Visitors ({visitors.length})</TabsTrigger>
            <TabsTrigger value="blocked">Blocked ({blocked.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="friends" className="mt-4">
            <FriendsList />
          </TabsContent>

          <TabsContent value="following" className="mt-4 space-y-2">

            {following.length === 0 ? <Empty icon={<Users />} text="You're not following anyone yet." /> :
              following.map(p => <PersonRow key={p.user_id} p={p} action={
                <div className="flex gap-2">
                  <Button asChild size="sm" variant="hero">
                    <Link to="/messages/$peerId" params={{ peerId: p.user_id }} onClick={e => e.stopPropagation()}><MessageCircle className="h-4 w-4 mr-1" /> Message</Link>
                  </Button>
                  <Button size="sm" variant="outline" onClick={(e) => { e.preventDefault(); e.stopPropagation(); void unfollow(p.user_id); }}><UserMinus className="h-4 w-4" /></Button>
                </div>
              } />)}
          </TabsContent>

          <TabsContent value="followers" className="mt-4 space-y-2">
            {followers.length === 0 ? <Empty icon={<Users />} text="No followers yet." /> :
              followers.map(p => <PersonRow key={p.user_id} p={p} action={
                <Button asChild size="sm" variant="hero" onClick={e => e.stopPropagation()}>
                  <Link to="/messages/$peerId" params={{ peerId: p.user_id }}><MessageCircle className="h-4 w-4 mr-1" /> Message</Link>
                </Button>
              } />)}
          </TabsContent>

          <TabsContent value="visitors" className="mt-4 space-y-2">
            {visitors.length === 0 ? <Empty icon={<Eye />} text="No profile visits yet." /> :
              visitors.map(p => <PersonRow key={p.user_id} p={p} subtitle={new Date(p.visited_at).toLocaleString()} />)}
          </TabsContent>

          <TabsContent value="blocked" className="mt-4 space-y-2">
            {blocked.length === 0 ? <Empty icon={<UserMinus />} text="No blocked users." /> :
              blocked.map(p => <PersonRow key={p.user_id} p={p} action={<Button size="sm" variant="outline" onClick={() => unblock(p.user_id)}>Unblock</Button>} />)}
          </TabsContent>
        </Tabs>
      </div>
      <Toaster />
    </div>
  );
}

function PersonRow({ p, action, subtitle }: { p: MiniProfile; action?: React.ReactNode; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:border-teal-500/50 transition">
      <Link to="/messages/$peerId" params={{ peerId: p.user_id }} className="flex items-center gap-3 flex-1 min-w-0">
        <div className="h-11 w-11 rounded-full overflow-hidden bg-secondary grid place-items-center shrink-0">
          {p.avatar_url ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover" /> : <Users className="h-5 w-5 text-muted-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{p.display_name || p.username || "User"}</p>
          {p.username && <p className="text-xs text-muted-foreground truncate">@{p.username}</p>}
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </Link>
      {action}
    </div>
  );
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
      <div className="mx-auto h-10 w-10 grid place-items-center opacity-60">{icon}</div>
      <p className="mt-2 text-sm">{text}</p>
    </div>
  );
}
