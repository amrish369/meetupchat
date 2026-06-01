import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Coins, Crown, Flame, Loader2, Trophy, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Global Leaderboard — Meetup Live" },
      { name: "description", content: "Top users on Meetup Live ranked by coins and daily streaks." },
    ],
  }),
  component: LeaderboardPage,
});

interface Row {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  coins: number;
  streak_days: number;
  is_premium: boolean;
}

function LeaderboardPage() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"global" | "country">("global");

  useEffect(() => {
    setLoading(true);
    const promise = scope === "global"
      ? supabase.rpc("global_leaderboard")
      : supabase.rpc("country_leaderboard", { p_country: (profile as any)?.country || (profile as any)?.region || "Unknown" });
    void promise.then(({ data }) => {
      setRows((data as Row[]) ?? []);
      setLoading(false);
    });
  }, [scope, (profile as any)?.country, (profile as any)?.region]);

  

  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-amber-500/5 to-background">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>

        <div className="mt-4 text-center">
          <Trophy className="mx-auto h-12 w-12 text-amber-400" />
          <h1 className="mt-3 text-4xl font-bold">Global Leaderboard</h1>
          <p className="mt-1 text-muted-foreground">Top contributors on Meetup Live</p>
        </div>

        <div className="mt-6 flex gap-2 justify-center">
          <Button size="sm" variant={scope === "global" ? "default" : "outline"} onClick={() => setScope("global")}>
            <Trophy className="h-4 w-4 mr-1" /> Global
          </Button>
          <Button size="sm" variant={scope === "country" ? "default" : "outline"} onClick={() => setScope("country")}>
            <Globe className="h-4 w-4 mr-1" /> My Country
          </Button>
        </div>

        {loading ? <div className="grid place-items-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div> : <>
        {/* Podium */}
        {top3.length > 0 && (
          <div className="mt-10 grid grid-cols-3 gap-3 items-end">
            {[1, 0, 2].map((idx, displayIdx) => {
              const r = top3[idx];
              if (!r) return <div key={displayIdx} />;
              const heights = ["h-24", "h-32", "h-20"];
              const colors = ["from-slate-300 to-slate-500", "from-amber-300 to-amber-600", "from-orange-400 to-orange-700"];
              const place = idx + 1;
              return (
                <Link key={r.user_id} to="/u/$userId" params={{ userId: r.user_id }} className="flex flex-col items-center">
                  {place === 1 && <Crown className="h-7 w-7 text-amber-400 mb-1" />}
                  <div className={`h-16 w-16 rounded-full overflow-hidden border-4 ${place === 1 ? "border-amber-400" : place === 2 ? "border-slate-400" : "border-orange-500"} bg-secondary`}>
                    {r.avatar_url ? <img src={r.avatar_url} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full grid place-items-center text-xl font-bold">{(r.display_name || "?")[0]}</div>}
                  </div>
                  <p className="mt-2 text-sm font-semibold truncate max-w-full">{r.display_name || r.username || "User"}</p>
                  <div className="flex items-center gap-1 text-xs text-amber-400 font-bold"><Coins className="h-3 w-3" />{r.coins}</div>
                  <div className={`mt-2 w-full rounded-t-xl ${heights[displayIdx]} bg-gradient-to-t ${colors[place - 1]} grid place-items-center text-2xl font-black text-white`}>{place}</div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Rest */}
        <div className="mt-6 rounded-3xl border border-border bg-card divide-y divide-border">
          {rest.map((r, i) => (
            <Link key={r.user_id} to="/u/$userId" params={{ userId: r.user_id }} className="flex items-center gap-3 p-3 hover:bg-secondary/50 transition">
              <span className="w-8 text-center text-muted-foreground font-mono">{i + 4}</span>
              <div className="h-10 w-10 rounded-full overflow-hidden bg-secondary">
                {r.avatar_url ? <img src={r.avatar_url} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full grid place-items-center font-bold">{(r.display_name || "?")[0]}</div>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{r.display_name || r.username || "User"}</p>
                {r.username && <p className="text-xs text-muted-foreground">@{r.username}</p>}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="flex items-center gap-1 text-orange-500"><Flame className="h-4 w-4" />{r.streak_days}</span>
                <span className="flex items-center gap-1 text-amber-400 font-bold"><Coins className="h-4 w-4" />{r.coins}</span>
              </div>
            </Link>
          ))}
          {rows.length === 0 && <p className="p-8 text-center text-muted-foreground">No users on the board yet — be the first!</p>}
        </div>
        </>}
      </div>
    </div>
  );
}
