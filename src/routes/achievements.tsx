import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/achievements")({
  head: () => ({ meta: [{ title: "Achievements — Meetup Live" }] }),
  component: AchievementsPage,
});

interface Ach { code: string; name: string; description: string; icon: string; reward_coins: number; sort_order: number; }

function AchievementsPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [all, setAll] = useState<Ach[]>([]);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(true);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);

  const load = async () => {
    if (!user) return;
    setBusy(true);
    const [{ data: a }, { data: u }] = await Promise.all([
      supabase.from("achievements").select("*").order("sort_order"),
      supabase.from("user_achievements").select("achievement_code").eq("user_id", user.id),
    ]);
    setAll((a ?? []) as Ach[]);
    setUnlocked(new Set((u ?? []).map((x: any) => x.achievement_code)));
    setBusy(false);
  };

  useEffect(() => { void load(); }, [user?.id]);

  const claim = async () => {
    const { data, error } = await supabase.rpc("check_achievements");
    if (error) { toast.error(error.message); return; }
    const newCount = (data ?? []).filter((d: any) => d.awarded).length;
    if (newCount > 0) toast.success(`Unlocked ${newCount} new badge${newCount > 1 ? 's' : ''}!`);
    else toast("No new badges yet. Keep going!");
    void load();
  };

  if (loading || busy) return <div className="min-h-screen grid place-items-center text-muted-foreground"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link to="/profile" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="mt-4 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><Trophy className="text-amber-400" /> Achievements</h1>
            <p className="text-sm text-muted-foreground">{unlocked.size} of {all.length} unlocked</p>
          </div>
          <Button onClick={claim} variant="hero">Check progress</Button>
        </div>

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {all.map(a => {
            const got = unlocked.has(a.code);
            return (
              <div key={a.code} className={`rounded-2xl border p-4 text-center transition ${got ? 'border-teal-500/50 bg-teal/5' : 'border-border bg-card opacity-60'}`}>
                <div className="text-4xl">{a.icon}</div>
                <h3 className="mt-2 font-semibold text-sm">{a.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{a.description}</p>
                <p className="mt-2 text-xs font-bold text-amber-500">+{a.reward_coins} coins</p>
                {got && <p className="mt-1 text-[10px] uppercase tracking-wide text-teal font-semibold">Unlocked</p>}
              </div>
            );
          })}
        </div>
      </div>
      <Toaster />
    </div>
  );
}
