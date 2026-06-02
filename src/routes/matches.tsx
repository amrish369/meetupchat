import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Video, Loader2, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getSessionId } from "@/lib/session";
import { downloadCSV } from "@/lib/csv";

export const Route = createFileRoute("/matches")({
  head: () => ({ meta: [{ title: "Match History — Meetup Live" }] }),
  component: MatchesPage,
});

interface Row { id: string; room_id: string; peer_session: string; started_at: string; ended_at: string | null; duration_sec: number }
const PAGE = 25;

function fmtDur(s: number) {
  if (!s) return "—";
  const m = Math.floor(s / 60), r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

function MatchesPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const sid = getSessionId();
  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(true);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);

  const load = useCallback(async (p: number) => {
    setBusy(true);
    const { data } = await supabase.rpc("my_match_history", { p_session_id: sid, p_limit: PAGE + 1, p_offset: p * PAGE });
    const arr = (data as Row[]) ?? [];
    setHasMore(arr.length > PAGE);
    setRows(arr.slice(0, PAGE));
    setBusy(false);
  }, [sid]);

  useEffect(() => { if (user) void load(page); }, [user?.id, page, load]);

  const exportAll = async () => {
    const all: Row[] = [];
    for (let p = 0; p < 200; p++) {
      const { data } = await supabase.rpc("my_match_history", { p_session_id: sid, p_limit: 500, p_offset: p * 500 });
      const arr = (data as Row[]) ?? [];
      all.push(...arr);
      if (arr.length < 500) break;
    }
    downloadCSV(`match-history-${Date.now()}.csv`, all as any, ["started_at", "ended_at", "duration_sec", "peer_session", "room_id", "id"]);
  };

  if (loading || (busy && rows.length === 0)) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Link to="/profile" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="mt-4 flex items-center justify-between gap-3">
          <h1 className="text-3xl font-bold flex items-center gap-2"><Video className="text-teal" /> Match History</h1>
          <Button variant="outline" size="sm" onClick={exportAll}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
        </div>
        <p className="text-sm text-muted-foreground">Your past video & chat matches on this device.</p>

        <div className="mt-6 space-y-2">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border p-8 text-center">No matches yet. Start a chat!</p>
          ) : rows.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Room {m.room_id.slice(0, 8)}…</p>
                <p className="text-xs text-muted-foreground">{new Date(m.started_at).toLocaleString()}</p>
              </div>
              <span className="text-sm font-semibold tabular-nums text-muted-foreground">{fmtDur(m.duration_sec)}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page === 0 || busy} onClick={() => setPage(p => Math.max(0, p - 1))}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Prev
          </Button>
          <span className="text-xs text-muted-foreground">Page {page + 1}</span>
          <Button variant="outline" size="sm" disabled={!hasMore || busy} onClick={() => setPage(p => p + 1)}>
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
      <Toaster />
    </div>
  );
}
