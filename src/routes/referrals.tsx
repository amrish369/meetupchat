import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Copy, Gift, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/referrals")({
  head: () => ({ meta: [{ title: "Referrals — Meetup Live" }] }),
  component: ReferralsPage,
});

function ReferralsPage() {
  const { user, profile, loading, refresh } = useAuth();
  const nav = useNavigate();
  const [code, setCode] = useState("");
  const [referrals, setReferrals] = useState<Array<{ referred_id: string; reward_coins: number; created_at: string }>>([]);
  const [redeemCode, setRedeemCode] = useState("");
  const [busy, setBusy] = useState(true);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("referral_code, referred_by").eq("user_id", user.id).maybeSingle(),
        supabase.from("referrals").select("referred_id, reward_coins, created_at").eq("referrer_id", user.id).order("created_at", { ascending: false }),
      ]);
      setCode((p as any)?.referral_code || "");
      setReferrals((r ?? []) as any);
      setBusy(false);
    })();
  }, [user?.id]);

  const link = typeof window !== "undefined" ? `${window.location.origin}/login?ref=${code}` : "";

  const copy = (txt: string) => {
    navigator.clipboard.writeText(txt);
    toast.success("Copied!");
  };

  const redeem = async () => {
    if (!redeemCode.trim()) return;
    const { data, error } = await supabase.rpc("redeem_referral", { p_code: redeemCode.trim() });
    if (error) { toast.error(error.message); return; }
    toast.success(`+${(data as any)?.coins_awarded ?? 50} coins!`);
    setRedeemCode("");
    void refresh?.();
  };

  if (loading || busy) return <div className="min-h-screen grid place-items-center text-muted-foreground"><Loader2 className="animate-spin" /></div>;

  const alreadyReferred = !!(profile as any)?.referred_by;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Link to="/profile" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <h1 className="mt-4 text-3xl font-bold flex items-center gap-2"><Gift className="text-teal" /> Invite & Earn</h1>
        <p className="text-sm text-muted-foreground">Earn 50 coins for every friend who joins with your code.</p>

        <div className="mt-6 rounded-3xl border border-teal-500/30 bg-teal/5 p-6">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Your code</p>
          <div className="mt-2 flex gap-2">
            <Input value={code} readOnly className="font-mono text-lg font-bold tracking-wider" />
            <Button onClick={() => copy(code)} variant="outline"><Copy className="h-4 w-4" /></Button>
          </div>
          <div className="mt-3 flex gap-2">
            <Input value={link} readOnly className="text-xs" />
            <Button onClick={() => copy(link)} variant="outline"><Copy className="h-4 w-4" /></Button>
          </div>
        </div>

        {!alreadyReferred && (
          <div className="mt-4 rounded-3xl border border-border bg-card p-6">
            <p className="font-semibold">Got a code?</p>
            <p className="text-xs text-muted-foreground">Both you and your friend get +50 coins.</p>
            <div className="mt-3 flex gap-2">
              <Input value={redeemCode} onChange={e => setRedeemCode(e.target.value.toUpperCase())} placeholder="ENTER CODE" maxLength={20} />
              <Button onClick={redeem}>Redeem</Button>
            </div>
          </div>
        )}

        <div className="mt-6">
          <h2 className="font-semibold flex items-center gap-2"><Users className="h-4 w-4" /> Your referrals ({referrals.length})</h2>
          <div className="mt-3 space-y-2">
            {referrals.length === 0 ? (
              <p className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border p-6 text-center">
                Share your code to start earning.
              </p>
            ) : referrals.map(r => (
              <div key={r.referred_id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-3">
                <Link to="/u/$userId" params={{ userId: r.referred_id }} className="text-sm font-medium hover:text-teal truncate">
                  Friend {r.referred_id.slice(0, 8)}
                </Link>
                <span className="text-sm font-bold text-amber-500">+{r.reward_coins}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Toaster />
    </div>
  );
}
