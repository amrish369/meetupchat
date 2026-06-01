import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, History as HistoryIcon, Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getSessionId } from "@/lib/session";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "Match History — Meetup Live" }] }),
  component: HistoryPage,
});

interface Match { id: string; room_id: string; created_at: string; ended_at: string | null; session_a: string; session_b: string; }

function HistoryPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [busy, setBusy] = useState(true);
  const sid = getSessionId();

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // matches has RLS denying direct read; use a safer approach via service path is not available.
      // Fallback: rely on match_queue/matches via RPC if added later. For now, show coin ledger as activity.
      const { data } = await supabase.from("coins_ledger").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
      setMatches([]);
      setBusy(false);
      // store activity in matches state slot via cast-free hack: actually use a separate state
      (window as any).__activity = data;
    })();
  }, [user?.id, sid]);

  if (loading || busy) return <div className="min-h-screen grid place-items-center text-muted-foreground"><Loader2 className="animate-spin" /></div>;
  const activity: any[] = (typeof window !== "undefined" && (window as any).__activity) || [];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Link to="/profile" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <h1 className="mt-4 text-3xl font-bold flex items-center gap-2"><HistoryIcon className="text-teal" /> Activity</h1>
        <p className="text-sm text-muted-foreground">Your recent coin transactions and rewards.</p>

        <div className="mt-6 space-y-2">
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border p-8 text-center">No activity yet.</p>
          ) : activity.map((a: any) => (
            <div key={a.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-3">
              <div>
                <p className="text-sm font-medium capitalize">{String(a.reason).replace(/_/g, ' ').replace(/:/g, ' · ')}</p>
                <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p>
              </div>
              <span className={`font-bold ${a.delta >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {a.delta >= 0 ? '+' : ''}{a.delta}
              </span>
            </div>
          ))}
        </div>
      </div>
      <Toaster />
    </div>
  );
}
