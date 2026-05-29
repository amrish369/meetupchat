import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Coins, Flame, Gift, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/rewards")({
  head: () => ({
    meta: [
      { title: "Rewards & Daily Spin — Meetup Live" },
      { name: "description", content: "Claim daily coins, spin the wheel, and grow your streak on Meetup Live." },
    ],
  }),
  component: RewardsPage,
});

const PRIZES = [
  { label: "+5", color: "from-slate-400 to-slate-600" },
  { label: "+15", color: "from-teal-400 to-teal-600" },
  { label: "+30", color: "from-violet-400 to-violet-600" },
  { label: "+5", color: "from-slate-400 to-slate-600" },
  { label: "+75", color: "from-amber-400 to-amber-600" },
  { label: "+15", color: "from-teal-400 to-teal-600" },
  { label: "+200", color: "from-pink-500 to-fuchsia-600" },
  { label: "+30", color: "from-violet-400 to-violet-600" },
];

function RewardsPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const nav = useNavigate();
  const [claiming, setClaiming] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [angle, setAngle] = useState(0);
  const [history, setHistory] = useState<Array<{ delta: number; reason: string; created_at: string }>>([]);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("coins_ledger")
      .select("delta, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setHistory((data as any) ?? []));
  }, [user, profile?.coins]);

  const today = new Date().toISOString().slice(0, 10);
  const alreadyClaimed = profile?.last_checkin === today;
  const nextReward = useMemo(() => Math.min(10 + 5 * ((profile?.streak_days ?? 0) + (alreadyClaimed ? 0 : 1)), 60), [profile, alreadyClaimed]);

  const claim = async () => {
    setClaiming(true);
    const { data, error } = await supabase.rpc("claim_daily_checkin");
    setClaiming(false);
    if (error) { toast.error(error.message); return; }
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.awarded > 0) toast.success(`+${row.awarded} coins! Streak ${row.streak} 🔥`);
    else toast.info("Already claimed today");
    await refreshProfile();
  };

  const spin = async () => {
    setSpinning(true);
    const fullSpins = 5;
    const segment = 360 / PRIZES.length;
    const { data, error } = await supabase.rpc("spin_wheel");
    if (error) {
      setSpinning(false);
      toast.error(error.message.includes("24h") ? "Come back in 24 hours for another spin!" : error.message);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    const prize = row?.prize ?? 5;
    // find first matching segment
    const idx = PRIZES.findIndex(p => p.label === `+${prize}`);
    const targetIdx = idx >= 0 ? idx : 0;
    const targetAngle = 360 * fullSpins + (360 - targetIdx * segment - segment / 2);
    setAngle(targetAngle);
    setTimeout(async () => {
      setSpinning(false);
      toast.success(row?.label ?? `+${prize} coins`);
      await refreshProfile();
    }, 4200);
  };

  if (loading || !profile) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-background/40">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link to="/profile" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        {/* Balance hero */}
        <div className="mt-6 rounded-3xl border border-border bg-gradient-to-br from-amber-500/10 via-card to-card p-6 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Your balance</p>
              <div className="mt-1 flex items-baseline gap-2">
                <Coins className="h-7 w-7 text-amber-400" />
                <span className="text-4xl font-bold">{profile.coins}</span>
                <span className="text-sm text-muted-foreground">coins</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Streak</p>
              <div className="mt-1 flex items-center gap-1.5 text-2xl font-bold">
                <Flame className="h-6 w-6 text-orange-500" />
                {profile.streak_days} <span className="text-sm font-normal text-muted-foreground">days</span>
              </div>
            </div>
          </div>
        </div>

        {/* Daily check-in */}
        <div className="mt-6 rounded-3xl border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold"><Gift className="h-5 w-5 text-teal-400" /> Daily check-in</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {alreadyClaimed ? "✅ Claimed today — come back tomorrow!" : `Claim +${nextReward} coins now. Streak grows your reward.`}
              </p>
            </div>
            <Button onClick={claim} disabled={claiming || alreadyClaimed} className="shrink-0">
              {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : alreadyClaimed ? "Claimed" : "Claim"}
            </Button>
          </div>
        </div>

        {/* Spin wheel */}
        <div className="mt-6 rounded-3xl border border-border bg-card p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Sparkles className="h-5 w-5 text-fuchsia-400" /> Daily Spin Wheel</h2>
          <p className="mt-1 text-sm text-muted-foreground">One free spin every 24 hours. Jackpot 200 coins!</p>

          <div className="mt-6 grid place-items-center">
            <div className="relative h-64 w-64">
              {/* Pointer */}
              <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1 z-10">
                <div className="h-0 w-0 border-x-[10px] border-x-transparent border-t-[16px] border-t-amber-400 drop-shadow-lg" />
              </div>
              {/* Wheel */}
              <motion.div
                className="h-full w-full rounded-full border-4 border-amber-400/40 shadow-2xl overflow-hidden relative"
                animate={{ rotate: angle }}
                transition={{ duration: 4, ease: [0.17, 0.67, 0.32, 1] }}
                style={{
                  background: `conic-gradient(${PRIZES.map((_, i) => {
                    const colors = ["#475569", "#14b8a6", "#8b5cf6", "#475569", "#f59e0b", "#14b8a6", "#ec4899", "#8b5cf6"];
                    const start = (i * 360) / PRIZES.length;
                    const end = ((i + 1) * 360) / PRIZES.length;
                    return `${colors[i]} ${start}deg ${end}deg`;
                  }).join(", ")})`,
                }}
              >
                {PRIZES.map((p, i) => {
                  const rot = (i * 360) / PRIZES.length + 360 / PRIZES.length / 2;
                  return (
                    <div
                      key={i}
                      className="absolute left-1/2 top-1/2 origin-bottom -translate-x-1/2 text-white font-bold text-lg"
                      style={{ transform: `translateX(-50%) rotate(${rot}deg) translateY(-90px)` }}
                    >
                      {p.label}
                    </div>
                  );
                })}
              </motion.div>
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 grid h-16 w-16 place-items-center rounded-full bg-background border-4 border-amber-400 shadow-xl">
                <Coins className="h-7 w-7 text-amber-400" />
              </div>
            </div>
          </div>

          <Button onClick={spin} disabled={spinning} className="mt-6 w-full h-12 text-base" variant="default">
            {spinning ? <Loader2 className="h-5 w-5 animate-spin" /> : "🎰 Spin the Wheel"}
          </Button>
        </div>

        {/* History */}
        <div className="mt-6 rounded-3xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Recent coins</h2>
          {history.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No activity yet — claim your daily bonus to get started.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {history.map((h, i) => (
                <li key={i} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-muted-foreground capitalize">{h.reason.replace(/_/g, " ")}</span>
                  <span className={h.delta > 0 ? "text-emerald-400 font-medium" : "text-rose-400 font-medium"}>
                    {h.delta > 0 ? "+" : ""}{h.delta}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <Toaster />
    </div>
  );
}
